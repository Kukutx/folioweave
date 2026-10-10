// The picture an audio file carries for itself: the cover its publisher tagged
// an MP3, FLAC or M4A with. Read at build time, so a track shows its official
// artwork without the author naming an image and without the browser parsing
// anything.

const signatures = [
  ["jpg", (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff],
  [
    "png",
    (data) => data.toString("latin1", 1, 4) === "PNG" && data[0] === 0x89,
  ],
  [
    "webp",
    (data) =>
      data.toString("latin1", 0, 4) === "RIFF" &&
      data.toString("latin1", 8, 12) === "WEBP",
  ],
  ["gif", (data) => /^GIF8[79]a$/.test(data.toString("latin1", 0, 6))],
];
/** What the bytes are, whatever the tag says they are. */
function picture(data, type = 0) {
  const match = data.length > 16 && signatures.find(([, is]) => is(data));
  return match ? { type, extension: match[0], data } : null;
}
/** The front cover where a file carries several pictures. */
const chosen = (pictures) =>
  pictures.find((item) => item.type === 3) ?? pictures[0] ?? null;

const syncsafe = (bytes, at) =>
  ((bytes[at] & 0x7f) << 21) |
  ((bytes[at + 1] & 0x7f) << 14) |
  ((bytes[at + 2] & 0x7f) << 7) |
  (bytes[at + 3] & 0x7f);
/** Undo ID3 unsynchronisation: a zero byte inserted after every 0xFF. */
function resynchronised(bytes) {
  const out = Buffer.allocUnsafe(bytes.length);
  let length = 0;
  for (let index = 0; index < bytes.length; index++) {
    out[length++] = bytes[index];
    if (bytes[index] === 0xff && bytes[index + 1] === 0) index++;
  }
  return out.subarray(0, length);
}
const id3Length = (bytes) =>
  bytes.toString("latin1", 0, 3) === "ID3" && bytes.length >= 10
    ? 10 + syncsafe(bytes, 6) + (bytes[5] & 0x10 ? 10 : 0)
    : 0;

function fromId3(bytes) {
  if (!id3Length(bytes)) return null;
  const major = bytes[3];
  const flags = bytes[5];
  if (major < 2 || major > 4) return null;
  let tag = bytes.subarray(10, 10 + syncsafe(bytes, 6));
  if (flags & 0x80 && major < 4) tag = resynchronised(tag);
  let at = 0;
  if (flags & 0x40 && major > 2)
    at = major === 4 ? syncsafe(tag, 0) : tag.readUInt32BE(0) + 4;
  const name = major === 2 ? 3 : 4;
  const head = major === 2 ? 6 : 10;
  const follows = (next) =>
    next === tag.length ||
    next + name > tag.length ||
    tag[next] === 0 ||
    /^[A-Z0-9]+$/.test(tag.toString("latin1", next, next + name));
  const pictures = [];
  while (at + head <= tag.length) {
    const id = tag.toString("latin1", at, at + name);
    if (!/^[A-Z0-9]+$/.test(id)) break;
    let size;
    if (major === 2) size = tag.readUIntBE(at + 3, 3);
    else if (major === 3) size = tag.readUInt32BE(at + 4);
    else {
      // Version 2.4 sizes are syncsafe, but some taggers wrote plain ones.
      size = syncsafe(tag, at + 4);
      const plain = tag.readUInt32BE(at + 4);
      if (
        plain !== size &&
        !follows(at + head + size) &&
        follows(at + head + plain)
      )
        size = plain;
    }
    const format = major === 2 ? 0 : tag[at + 9];
    let body = tag.subarray(at + head, at + head + size);
    at += head + size;
    if (id !== "APIC" && id !== "PIC") continue;
    // Compressed or encrypted frames are left alone.
    if (format & (major === 4 ? 0x0c : 0xc0)) continue;
    if (major === 4) {
      if (format & 0x40) body = body.subarray(1);
      if (format & 0x01) body = body.subarray(4);
      if (format & 0x02 || flags & 0x80) body = resynchronised(body);
    } else if (major === 3 && format & 0x20) body = body.subarray(1);
    const wide = body[0] === 1 || body[0] === 2;
    let cursor = 1;
    if (major === 2) cursor += 3;
    else {
      cursor = body.indexOf(0, cursor) + 1;
      if (!cursor) continue;
    }
    const type = body[cursor++];
    if (wide) {
      while (cursor + 1 < body.length && (body[cursor] || body[cursor + 1]))
        cursor += 2;
      cursor += 2;
    } else {
      cursor = body.indexOf(0, cursor) + 1;
      if (!cursor) continue;
    }
    const found = picture(body.subarray(cursor), type);
    if (found) pictures.push(found);
  }
  return chosen(pictures);
}

function fromFlac(bytes) {
  // Some taggers put an ID3 tag in front of the stream marker.
  let at = id3Length(bytes);
  if (bytes.toString("latin1", at, at + 4) !== "fLaC") return null;
  at += 4;
  const pictures = [];
  for (;;) {
    if (at + 4 > bytes.length) break;
    const header = bytes[at];
    const size = bytes.readUIntBE(at + 1, 3);
    const body = bytes.subarray(at + 4, at + 4 + size);
    at += 4 + size;
    if ((header & 0x7f) === 6 && body.length > 32) {
      let cursor = 4;
      cursor += 4 + body.readUInt32BE(cursor);
      cursor += 4 + body.readUInt32BE(cursor);
      cursor += 16;
      const length = body.readUInt32BE(cursor);
      const found = picture(
        body.subarray(cursor + 4, cursor + 4 + length),
        body.readUInt32BE(0),
      );
      if (found) pictures.push(found);
    }
    if (header & 0x80) break;
  }
  return chosen(pictures);
}

/** The body of the first child box of this type, or null. */
function box(bytes, type, start = 0, end = bytes.length) {
  for (let at = start; at + 8 <= end;) {
    let size = bytes.readUInt32BE(at);
    let head = 8;
    if (size === 1) {
      if (at + 16 > end) return null;
      size = Number(bytes.readBigUInt64BE(at + 8));
      head = 16;
    } else if (size === 0) size = end - at;
    if (size < head || at + size > end) return null;
    if (bytes.toString("latin1", at + 4, at + 8) === type)
      return [at + head, at + size];
    at += size;
  }
  return null;
}
function fromMp4(bytes) {
  if (bytes.toString("latin1", 4, 8) !== "ftyp") return null;
  let range = [0, bytes.length];
  for (const type of ["moov", "udta", "meta", "ilst", "covr", "data"]) {
    range = box(bytes, type, ...range);
    if (!range) return null;
    // `meta` begins with a version and flags before its children.
    if (type === "meta") range[0] += 4;
  }
  // A type indicator and a locale precede the picture itself.
  return picture(bytes.subarray(range[0] + 8, range[1]));
}

/** The embedded cover as `{ extension, data }`, or null where the file carries
 * none, is not a format read here, or is damaged. Never throws. */
export function embeddedArtwork(bytes) {
  try {
    const found = fromId3(bytes) ?? fromFlac(bytes) ?? fromMp4(bytes);
    return found ? { extension: found.extension, data: found.data } : null;
  } catch {
    return null;
  }
}

const selector = /^[a-zA-Z][a-zA-Z0-9]*(?:\.(?:\*|[a-zA-Z][a-zA-Z0-9]*))*$/;
function selected(value, segments) {
  if (!segments.length)
    return value && typeof value === "object" ? [value] : [];
  const [key, ...rest] = segments;
  if (key === "*")
    return Array.isArray(value)
      ? value.flatMap((item) => selected(item, rest))
      : [];
  return value && Object.hasOwn(value, key) ? selected(value[key], rest) : [];
}

/**
 * Apply a manifest's `embeddedArtwork` rules, each
 * `{ "each": "tracks.*", "audio": "src", "image": "cover" }`: an item that
 * names a published local audio file and no image takes the picture the file
 * carries, published beside it as `<name>.cover.<type>`. An image the author
 * names always wins, and a remote file is never fetched to look inside it.
 *
 * Returns the options with those images named and the images to publish.
 */
export function withEmbeddedArtwork(manifest, options, publishedBytes) {
  const rules = manifest.embeddedArtwork ?? [];
  const images = new Map();
  if (
    !Array.isArray(rules) ||
    rules.some(
      (rule) =>
        !selector.test(rule?.each ?? "") ||
        !/^[a-zA-Z][a-zA-Z0-9]*$/.test(rule.audio ?? "") ||
        !/^[a-zA-Z][a-zA-Z0-9]*$/.test(rule.image ?? ""),
    )
  )
    throw new Error(`${manifest.id}: invalid embeddedArtwork declaration`);
  if (!rules.length) return { options, images };
  const next = structuredClone(options);
  for (const rule of rules)
    for (const item of selected(next, rule.each.split("."))) {
      const audio = item[rule.audio];
      if (item[rule.image] !== undefined || typeof audio !== "string") continue;
      const bytes = audio.startsWith("/portfolio/") && publishedBytes(audio);
      const artwork = bytes && embeddedArtwork(bytes);
      if (!artwork) continue;
      const target = `${audio.replace(/\.[^./]+$/, "")}.cover.${artwork.extension}`;
      // A file the author published under that name is theirs to keep.
      if (publishedBytes(target)) continue;
      item[rule.image] = target;
      images.set(target, artwork.data);
    }
  return { options: next, images };
}
