/* eslint-disable react/display-name -- each specimen is a drawing factory, StampFace renders it */
// The six specimen stamps of the default collage (recordings 338 / 339), drawn in code on the
// 190 × 237 stamp box: real type, gradients, screens and textures. Only genuine photographs stay
// pictures (the factory of the Specimen stamp and the dark halftone photo), cropped to their art.
// The GAO HAN line faces and the hand-drawn "motion" are vector outlines (art-paths.ts).

import { CRAFT_FIELD, FACES_INK, FACES_PAPER, FACES_SEAM, MARBLE_FIELD, MOTION, type TracedField } from "./art-paths";
import type { StampArt, StampArtProps } from "./paper";
import s from "./stamps.module.css";

const A = "/templates/stack/stamps/";

/** The printed window of a stamp: the art area inside the white margin. */
const WIN = { x: 17.25, y: 17.5, w: 155.5, h: 202, r: 5.5 };

type Txt = {
  t: string;
  x: number;
  /** baseline (or, for CJK, the middle of the em box) */
  y: number;
  size: number;
  /** advance width the run is fitted to, so any fallback face keeps the layout */
  len?: number;
  font: "mono" | "type" | "sans" | "cjk" | "serif";
  weight?: number;
  italic?: boolean;
  fill: string;
  anchor?: "start" | "middle";
  /** drawn as an outline of this colour instead of filled */
  outline?: string;
};

const FONT = { mono: s.fMono, type: s.fType, sans: s.fSans, cjk: s.fCjk, serif: s.fSerif };

/**
 * The type of a stamp: HTML text in the drawing's units (a foreignObject), placed on its baseline
 * and fitted to its length by StampFace once the fonts are in. HTML, not SVG <text>: SVG text is
 * laid out again whenever anything above it moves, and the stamps move all the time.
 */
const type = (w: number, h: number, runs: Txt[]) => (
  <foreignObject x={0} y={0} width={w} height={h}>
    <div className={s.type}>
      {runs.map((l, i) => (
        <span
          key={i}
          data-run=""
          data-y={l.y}
          data-len={l.len}
          data-anchor={l.anchor}
          data-mid={l.font === "cjk" ? "" : undefined}
          className={`${s.run} ${FONT[l.font]}`}
          style={{
            left: l.x,
            top: l.y - l.size * 0.85,
            fontSize: l.size,
            fontWeight: l.weight,
            fontStyle: l.italic ? "italic" : undefined,
            color: l.outline ? "transparent" : l.fill,
            WebkitTextStroke: l.outline ? `0.6px ${l.outline}` : undefined,
            transform: l.anchor === "middle" ? "translateX(-50%)" : undefined,
          }}
        >
          {l.t}
          <i className={s.base} />
        </span>
      ))}
    </div>
  </foreignObject>
);

const winRect = (fill: string, extra?: Record<string, string>) => (
  <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx={WIN.r} fill={fill} {...extra} />
);

/** The window as a clip path, so pictures and textures keep its rounded corners. */
const winClip = (id: string) => (
  <clipPath id={id}>
    <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx={WIN.r} />
  </clipPath>
);

/** A printer's dot screen at 45°, laid over a tone (pitch in box units). */
const screen = (id: string, dot: string, pitch = 2.26, r = 0.62, gap?: string) => (
  <pattern id={id} width={pitch} height={pitch} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    {gap && <rect width={pitch} height={pitch} fill={gap} />}
    <circle cx={pitch / 2} cy={pitch / 2} r={pitch * r * 0.5} fill={dot} />
  </pattern>
);

/** Micro-type texture: rows of tiny word-like marks (the fill of the C ring and the faces column).
 *  `glyphs` sets it as set type instead: a run of glyph-sized cells of `h` height, words split
 *  by spaces, each cell in one of the inks. */
function microType(
  id: string,
  ink: string | string[],
  rows = 6,
  pitch = 2.05,
  width = 30,
  glyphs?: { h: number; cell: [number, number]; gap: number; space: number },
) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const inks = typeof ink === "string" ? [ink] : ink;
  // every mark is a little rounded bar; one path per ink
  const d = inks.map(() => "");
  const f = (v: number) => +v.toFixed(3);
  const bar = (x: number, y: number, len: number, h: number, r: number) =>
    `M${f(x + r)} ${f(y)}h${f(len - 2 * r)}a${f(r)} ${f(h / 2)} 0 0 1 0 ${f(h)}h${f(2 * r - len)}a${f(r)} ${f(h / 2)} 0 0 1 0 ${-f(h)}z`;
  for (let j = 0; j < rows; j++) {
    let x = rnd() * 2;
    if (glyphs) {
      const { h, cell, gap, space } = glyphs;
      const y = j * pitch + (pitch - h) / 2;
      while (x < width) {
        const w = cell[0] + rnd() * (cell[1] - cell[0]);
        const len = Math.min(w, width - x);
        const k = Math.floor(rnd() * inks.length);
        if (rnd() > space) d[k] += bar(x, y + (rnd() - 0.5) * 0.2, len, h * (0.8 + rnd() * 0.25), Math.min(0.25, len / 2));
        x += w + gap;
      }
      continue;
    }
    const y = j * pitch + 0.45;
    while (x < width) {
      const w = 0.6 + rnd() * 2.6;
      const len = Math.min(w, width - x);
      d[0] += bar(x, y, len, 0.62, Math.min(0.3, len / 2));
      x += w + 0.45 + (rnd() < 0.2 ? 0.9 : 0);
    }
  }
  return (
    <pattern id={id} width={width} height={rows * pitch} patternUnits="userSpaceOnUse">
      {d.map((p, i) => p && <path key={i} d={p} fill={inks[i]} />)}
    </pattern>
  );
}

/** A speckle: a tile of `n` round flecks of radius `r` in the given inks, scattered by a fixed seed. */
function speckle(id: string, inks: string[], size = 24, n = 300, r: [number, number] = [0.3, 0.7], seed = 11) {
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const d = inks.map(() => "");
  const f = (v: number) => +v.toFixed(2);
  for (let k = 0; k < n; k++) {
    const [x, y, rr, ink] = [rnd() * size, rnd() * size, r[0] + rnd() * (r[1] - r[0]), Math.floor(rnd() * inks.length)];
    // drawn again across the edges it crosses, so the tile repeats without seams
    for (const [dx, dy] of [[0, 0], [-size, 0], [0, -size], [-size, -size]])
      if ((dx === 0 || x + rr > size) && (dy === 0 || y + rr > size))
        d[ink] += `M${f(x + dx - rr)} ${f(y + dy)}a${f(rr)} ${f(rr)} 0 1 0 ${f(2 * rr)} 0a${f(rr)} ${f(rr)} 0 1 0 ${f(-2 * rr)} 0`;
  }
  return (
    <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
      {d.map((p, i) => p && <path key={i} d={p} fill={inks[i]} />)}
    </pattern>
  );
}

/* ------------------------------------------------------------------------------------------------ */

/** Specimen.: a halftone photograph of a factory, typewritten caption. */
export const specimen =
  (photo = A + "factory.webp", caption = "Specimen.", code = "N1025"): StampArt =>
  ({ uid, w, h }: StampArtProps) => (
    <>
      <defs>{winClip(`${uid}w`)}</defs>
      <image
        href={photo}
        x={17.5}
        y={17.5}
        width={155}
        height={202}
        preserveAspectRatio="none"
        clipPath={`url(#${uid}w)`}
      />
      {type(w, h, [
        { t: caption, x: 24.5, y: 186.6, size: 17.6, len: 84.6, font: "type", fill: "#2b2522" },
        { t: code, x: 24, y: 204.6, size: 10.4, len: 28.4, font: "type", fill: "#3a3330" },
      ])}
    </>
  );

/** KENSHO TECHNOLOGIES: mono type and the C ring, printed with a micro-type texture. */
export const kensho =
  (l1 = "KENSHO", l2 = "TECHNOLGIES", month = "05", year = "2026", day = "08"): StampArt =>
  ({ uid, lite, w, h }: StampArtProps) => {
    const ink = "#353535";
    // the C: a thick band from the top round the left to its cut at -35.5°, then a band thinning
    // in two steps round the right, stopping short of the cut (angles in degrees, y up)
    const c = { x: 117.2, y: 164.7, R: 49, r1: 28.4, r2: 38, r3: 44.6 };
    const P = (r: number, a: number) => {
      const t = (a * Math.PI) / 180;
      return `${(c.x + r * Math.cos(t)).toFixed(2)} ${(c.y - r * Math.sin(t)).toFixed(2)}`;
    };
    const ring =
      `M${P(c.R, -27)}A${c.R} ${c.R} 0 1 0 ${P(c.R, -35.5)}` +
      `L${P(c.r1, -35.5)}A${c.r1} ${c.r1} 0 1 1 ${P(c.r1, 88)}` +
      `L${P(c.r2, 88)}A${c.r2} ${c.r2} 0 0 1 ${P(c.r2, 32)}` +
      `L${P(c.r3, 32)}A${c.r3} ${c.r3} 0 0 1 ${P(c.r3, -27)}Z`;
    return (
      <>
        <defs>{!lite && microType(`${uid}m`, ["#707070", "#7f7f7f", "#8b8b8b"], 9, 1.9, 31, { h: 1.2, cell: [1.3, 3], gap: 0.42, space: 0.05 })}</defs>
        <path d={ring} fill="#3f3f3f" />
        {!lite && <path d={ring} fill={`url(#${uid}m)`} />}
        {type(w, h, [
          { t: l1, x: 22.1, y: 38.5, size: 16.2, len: 58.4, font: "mono", weight: 300, fill: ink },
          { t: "-", x: 162.8, y: 38.5, size: 16.2, font: "mono", weight: 300, fill: ink, anchor: "middle" },
          { t: ".", x: 25.6, y: 60, size: 16.2, font: "mono", weight: 300, fill: ink, anchor: "middle" },
          { t: l2, x: 56.4, y: 60, size: 16.2, len: 108.6, font: "mono", weight: 300, fill: ink },
          { t: month, x: 25.4, y: 100.5, size: 19.6, len: 21.2, font: "mono", weight: 300, fill: ink },
          { t: year, x: 119.4, y: 100.5, size: 19.6, len: 44.6, font: "mono", weight: 300, fill: ink },
          { t: "-", x: 30, y: 128.3, size: 19.6, font: "mono", weight: 300, fill: ink, anchor: "middle" },
          { t: day, x: 25.4, y: 214.5, size: 19.6, len: 21.2, font: "mono", weight: 300, fill: ink },
        ])}
      </>
    );
  };

/** Maps a field colour at a tone level (0 at the base, 1 at the deepest layer) to the colour to lay
 *  under that level's screen. */
type Under = (c: string, level: number) => string;

/** A halftone over a traced field: a screen of `ink` dots on `paper` (dots covering half of each
 *  cell), drawn at opacity `a0` everywhere and `a1` more through the field's tone mask, so it
 *  strengthens with the tone. `under` lifts the field colours so field and screen together read
 *  as the recorded colours. */
const halftone = (ink: string, paper: string, a0: number, a1: number) => {
  const rgb = (c: string) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
  const [i, p] = [rgb(ink), rgb(paper)];
  const mean = i.map((v, k) => (v + p[k]) / 2);
  const under: Under = (c, level) => {
    const a = 1 - (1 - a0) * (1 - a1 * Math.max(0, level));
    const v = rgb(c).map((x, k) => Math.round(Math.min(255, Math.max(0, (x - a * mean[k]) / (1 - a)))));
    return "#" + v.map((x) => x.toString(16).padStart(2, "0")).join("");
  };
  return { under, a0: String(a0), a1: String(a1) };
};

/** A traced tone field: smooth layers blurred into one another. The layers are kept as `#${uid}l<i>`
 *  for `toneMask`. */
const tracedField = (uid: string, f: TracedField, soft = 2, under?: Under) => {
  const col = (c: string, i: number) => (under ? under(c, (i + 1) / f.layers.length) : c);
  return (
  <>
    <filter id={`${uid}fb`} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h}>
      <feGaussianBlur stdDeviation={soft} />
    </filter>
    <defs>
      {f.layers.map(([, d], i) => (
        <path key={i} id={`${uid}l${i}`} d={d} fillRule="evenodd" />
      ))}
    </defs>
    {winRect(col(f.base, -1))}
    <g filter={`url(#${uid}fb)`}>
      {/* bled past the window, so the blur never pulls the base colour in at its edge */}
      <rect x={WIN.x - 8} y={WIN.y - 8} width={WIN.w + 16} height={WIN.h + 16} fill={col(f.base, -1)} />
      {f.layers.map(([c], i) => (
        <use key={i} href={`#${uid}l${i}`} fill={col(c, i)} />
      ))}
    </g>
  </>
  );
};

/** A mask as dark as the field: white over its deepest layer, falling in even steps to black at
 *  its base, so a screen drawn through it grows with the tone, as a halftone's dots do. */
const toneMask = (uid: string, f: TracedField, id: string) => (
  <mask id={id} maskUnits="userSpaceOnUse" x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h}>
    {f.layers.map((_, i) => {
      const g = Math.round(((i + 1) / f.layers.length) * 255);
      return <use key={i} href={`#${uid}l${i}`} fill={`rgb(${g},${g},${g})`} />;
    })}
  </mask>
);

/** The field's sharper spots (pale blots), as `#${uid}sp`, so they can be drawn again over a
 *  screen: a halftone's dots shrink where the tone is pale. */
const tracedSpots = (uid: string, f: TracedField, spot = 1) => (
  <>
    <filter id={`${uid}fs`} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h}>
      <feGaussianBlur stdDeviation={spot} />
    </filter>
    <g id={`${uid}sp`} filter={`url(#${uid}fs)`}>
      {f.spots.map(([c, d], i) => (
        <path key={i} d={d} fill={c} fillRule="evenodd" />
      ))}
    </g>
  </>
);

/** NEW CRAFT SOCIETY: a soft green field with pale blots under a dot screen, mono type. */
export const craft =
  (l1 = "NEW CRAFT", l2 = "SOCIETY._", date = "01/2025", field: TracedField = CRAFT_FIELD): StampArt =>
  ({ uid, lite, w, h }: StampArtProps) => {
    const ink = "#93a387";
    return (
      <>
        <defs>
          {winClip(`${uid}w`)}
          {!lite && screen(`${uid}h`, "#4f6b3d", 2.305, 0.8, "#eef6d6")}
        </defs>
        <g clipPath={`url(#${uid}w)`}>
          {tracedField(uid, field, 1)}
          {tracedSpots(uid, field, 0.8)}
          {!lite && winRect(`url(#${uid}h)`, { opacity: "0.14" })}
          {!lite && <use href={`#${uid}sp`} opacity="0.6" />}
        </g>
        {type(w, h, [
          { t: l1, x: 32.2, y: 38.9, size: 12.2, len: 54, font: "mono", weight: 300, fill: ink },
          { t: l2, x: 32.2, y: 50.4, size: 12.2, len: 54, font: "mono", weight: 300, fill: ink },
          { t: date, x: 113.5, y: 203.6, size: 12.2, len: 44.6, font: "mono", weight: 300, fill: ink },
        ])}
      </>
    );
  };

/** motion: marbled mint paper (pools and pale veins) under a dot screen, the word drawn by hand in
 *  a pale line. */
const MARBLE_INK = "#369965";
const MARBLE_PAPER = "#f0f5eb";

export const marble =
  (word = "motion", field: TracedField = MARBLE_FIELD): StampArt =>
  ({ uid, lite }: StampArtProps) => {
    const ht = halftone(MARBLE_INK, MARBLE_PAPER, 0.08, 0.4);
    return (
    <>
      <defs>
        {winClip(`${uid}w`)}
        {!lite && screen(`${uid}h`, MARBLE_INK, 2.305, 0.8, MARBLE_PAPER)}
        {!lite && toneMask(uid, field, `${uid}tm`)}
      </defs>
      <g clipPath={`url(#${uid}w)`}>
        {tracedField(uid, field, 0.8, lite ? undefined : ht.under)}
        {tracedSpots(uid, field, 0.5)}
        {!lite && winRect(`url(#${uid}h)`, { opacity: ht.a0 })}
        {!lite && winRect(`url(#${uid}h)`, { opacity: ht.a1, mask: `url(#${uid}tm)` })}
        {!lite && <use href={`#${uid}sp`} opacity="0.6" />}
      </g>
      <path d={MOTION} fill="#f1f7ea">
        <title>{word}</title>
      </path>
    </>
  );
  };

/** A dark halftone photograph; where the recording never showed it clean, the black screen runs on. */
export const night =
  (photo = A + "night.webp", title = "Lu"): StampArt =>
  ({ uid, lite, w, h }: StampArtProps) => (
    <>
      <defs>
        {winClip(`${uid}w`)}
        {!lite && screen(`${uid}h`, "#3d3d3d", 2.9, 0.5)}
        {!lite && speckle(`${uid}k`, ["#555555", "#6f6f6f"], 24, 70, [0.12, 0.3], 5)}
      </defs>
      <g clipPath={`url(#${uid}w)`}>
        {winRect("#171717")}
        {!lite && winRect(`url(#${uid}h)`)}
        {!lite && winRect(`url(#${uid}k)`)}
        <image href={photo} x={17.5} y={17.5} width={155} height={155} preserveAspectRatio="none" />
        {/* the cover's lines of serif type, all but the last one's foot hidden under the stamps on top */}
        <path d="M132 49.6h2l1.8-9.6h-2z" fill="#d9d9d9" />
      </g>
      {type(w, h, [{ t: title, x: 124.4, y: 73.9, size: 23.5, font: "serif", italic: true, weight: 400, fill: "#d9d9d9" }])}
    </>
  );

/** 高晗 GAO HAN: CJK and Latin type, and a column of line-drawn faces on a speckled grey ground. */
export const gaoHan =
  (cjk = ["高", "晗"], l1 = "GAO", l2 = "HAN", foot = "DESIGN HERO"): StampArt =>
  ({ uid, lite, w, h }: StampArtProps) => {
    const ink = "#0b0b0b";
    const latin: Txt[] = [
      { t: l1, x: 28.7, y: 158.8, size: 22.4, len: 51, font: "sans", weight: 400, fill: ink },
      { t: l2, x: 28.7, y: 188.8, size: 22.4, len: 51.4, font: "sans", weight: 400, fill: ink },
    ];
    // GAO HAN is printed twice: a grey outline a little down and to the right, then the black
    const ghost = latin.map((l) => ({ ...l, x: l.x + 1.2, y: l.y + 1.7, outline: "#9d9d9d" }));
    return (
      <>
        <defs>{!lite && speckle(`${uid}m`, ["#8f8f8f", "#a6a6a6", "#bcbcbc", "#f3f3f3"], 24, 900, [0.22, 0.5])}</defs>
        {/* the column: a grey ground, speckled except in the clean blocks the faces sit in */}
        <rect x={96.5} y={26.5} width={66} height={183.5} fill="#efefef" />
        {!lite && <rect x={96.5} y={26.5} width={66} height={183.5} fill={`url(#${uid}m)`} />}
        <path d={FACES_PAPER} fill="#e9e9e9" />
        {/* the same grain, faint, inside them */}
        {!lite && <path d={FACES_PAPER} fill={`url(#${uid}m)`} opacity="0.2" />}
        <path d={FACES_SEAM} fill="#a3a3a3" />
        <path d={FACES_INK} fill={ink} />
        {type(w, h, [
          ...cjk.map((ch, i): Txt => ({
            t: ch,
            x: 55.2,
            y: 52.6 + i * 54.8,
            size: 55,
            font: "cjk",
            weight: 400,
            fill: ink,
            anchor: "middle",
          })),
          ...ghost,
          ...latin,
          { t: foot, x: 28.4, y: 209.4, size: 9.8, len: 52.6, font: "sans", weight: 600, fill: ink },
        ])}
      </>
    );
  };
