// The stamp itself, drawn in SVG: perforated paper (the outline is one path: a rectangle with
// half-round holes punched along every edge), the paper's colour and grain, and the stamp's
// artwork on top. A stamp is either a design drawn in code (`art`) or a picture (`src`).

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";

export type StampArtProps = {
  /** Unique prefix for ids of gradients, patterns and filters inside this drawing. */
  uid: string;
  /** A lighter drawing for the out-of-focus copy: no grain or screens (they vanish in the blur). */
  lite: boolean;
  w: number;
  h: number;
};

/** A stamp design drawn in code, on a design box of `w × h` units (190 × 237 for the specimens). */
export type StampArt = (p: StampArtProps) => ReactNode;

// perforation, as measured on the recorded stamps (190 × 237): holes on a 29.5 pitch, centred on
// the edge, 8.9 along it and 9.5 deep; a hole never sits closer than ~30 to a corner
export const PERF = { pitch: 29.5, along: 8.9, deep: 9.5, corner: 30 };

const n2 = (v: number) => +v.toFixed(2);

/** Outline of a perforated stamp of `w × h`, as an SVG path. */
export function perforation(w: number, h: number, p = PERF) {
  const holes = (len: number) => {
    const n = Math.max(1, Math.floor((len - 2 * p.corner) / p.pitch) + 1);
    const first = (len - (n - 1) * p.pitch) / 2;
    return Array.from({ length: n }, (_, i) => first + i * p.pitch);
  };
  const a = p.along,
    d = p.deep;
  let s = "M0 0";
  for (const x of holes(w)) s += `H${n2(x - a)}A${a} ${d} 0 0 0 ${n2(x + a)} 0`;
  s += `H${w}`;
  for (const y of holes(h)) s += `V${n2(y - a)}A${d} ${a} 0 0 0 ${w} ${n2(y + a)}`;
  s += `V${h}`;
  for (const x of holes(w).reverse()) s += `H${n2(x + a)}A${a} ${d} 0 0 0 ${n2(x - a)} ${h}`;
  s += "H0";
  for (const y of holes(h).reverse()) s += `V${n2(y + a)}A${d} ${a} 0 0 0 0 ${n2(y - a)}`;
  return s + "Z";
}

/** The perforated outline as a CSS mask image (for the lightbox light and the aged print). */
export function perforationMask(w: number, h: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${perforation(w, h)}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Type is HTML set inside the drawing (see specimens.tsx): each run is put on its baseline and
// stretched to its printed length. All faces are fitted in one pass (every measure first, then every
// write), so mounting a sheet of stamps costs one layout, and again once per font that comes in.
const faces = new Set<SVGSVGElement>();
const due = new Set<SVGSVGElement>();
let queued = false;
let listening = false;

function fitDue() {
  queued = false;
  const runs: HTMLElement[] = [];
  for (const svg of due) if (svg.isConnected) runs.push(...svg.querySelectorAll<HTMLElement>("[data-run]"));
  due.clear();
  const m = runs.map((el) => ({
    base: (el.lastElementChild as HTMLElement | null)?.offsetTop ?? 0,
    w: el.offsetWidth,
    h: el.offsetHeight,
  }));
  runs.forEach((el, i) => {
    const d = el.dataset;
    const y = Number(d.y);
    el.style.top = `${(d.mid !== undefined ? y - m[i].h / 2 : y - m[i].base).toFixed(2)}px`;
    const len = Number(d.len || 0);
    if (len && m[i].w) el.style.transform = `scaleX(${(len / m[i].w).toFixed(4)})`;
  });
}

function fitLater(svgs: Iterable<SVGSVGElement>) {
  for (const svg of svgs) due.add(svg);
  if (!queued && due.size) {
    queued = true;
    queueMicrotask(fitDue); // still before the frame is painted
  }
}

function watchFonts() {
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (listening || !fonts) return;
  listening = true;
  const all = () => fitLater(faces);
  fonts.ready.then(all);
  fonts.addEventListener?.("loadingdone", all);
}

/**
 * One stamp face: the perforated sheet in its paper colour with a fine grain, and the artwork.
 * `className` sizes it (it fills its box); the drawing scales with it and stays sharp.
 */
export function StampFace({
  art,
  src,
  paper = "#f4f3f1",
  w,
  h,
  lite = false,
  seed = 1,
  className,
  title,
}: {
  art?: StampArt;
  src?: string;
  paper?: string;
  w: number;
  h: number;
  lite?: boolean;
  seed?: number;
  className?: string;
  title?: string;
}) {
  const uid = "s" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<SVGSVGElement>(null);
  // set the type on its baselines and fit each run to its length (again whenever a font comes in)
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg || !svg.querySelector("[data-run]")) return;
    faces.add(svg);
    watchFonts();
    fitLater([svg]);
    return () => {
      faces.delete(svg);
      due.delete(svg);
    };
  }, [art, w, h]);
  if (!art && src)
    return <img className={className} src={src} alt={title ?? ""} draggable={false} decoding="async" />;
  const clip = `${uid}c`;
  return (
    <svg
      ref={ref}
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={clip}>
          <path d={perforation(w, h)} />
        </clipPath>
        {!lite && (
          // paper grain: sparse grey fibres and specks, and a faint unevenness of the sheet
          <filter
            id={`${uid}g`}
            x="0"
            y="0"
            width={w}
            height={h}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed={seed} result="n" />
            <feColorMatrix
              in="n"
              type="matrix"
              values="0 0 0 0 0.3  0 0 0 0 0.3  0 0 0 0 0.29  0 0 0 -9 2.65"
              result="specks"
            />
            {/* the cloudy unevenness of the sheet */}
            <feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="3" seed={seed + 1} result="c" />
            <feColorMatrix
              in="c"
              type="matrix"
              values="0 0 0 0 0.3  0 0 0 0 0.3  0 0 0 0 0.3  0.5 0 0 0 -0.18"
              result="cloud"
            />
            <feMerge>
              <feMergeNode in="cloud" />
              <feMergeNode in="specks" />
            </feMerge>
          </filter>
        )}
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width={w} height={h} fill={paper} />
        {!lite && <rect width={w} height={h} filter={`url(#${uid}g)`} opacity="0.16" />}
        {art ? art({ uid: uid + "a", lite, w, h }) : null}
        {/* the cut edge of the sheet: a hairline of shade just inside the perforation */}
        <path d={perforation(w, h)} fill="none" stroke="#000" strokeOpacity="0.07" strokeWidth="0.9" />
      </g>
    </svg>
  );
}
