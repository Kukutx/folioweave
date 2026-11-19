/** A name that is safe as one file inside a ZIP or a download. */
export function safeFileName(name: string): string {
  const cleaned = Array.from(name.replace(/[\\/:*?"<>|]/g, "_"))
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join("")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 80);
  return cleaned || "sticker";
}

/** Safe, distinct file names in order: a repeated name gets _1, _2… */
export function uniqueFileNames(names: readonly string[], extension: string) {
  const used = new Set<string>();
  return names.map((name) => {
    const base = safeFileName(name);
    let candidate = base;
    for (let n = 1; used.has(candidate.toLowerCase()); n++)
      candidate = `${base}_${n}`;
    used.add(candidate.toLowerCase());
    return `${candidate}${extension}`;
  });
}

/** Starts a download of a blob the caller does not need to keep. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
