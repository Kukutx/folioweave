// The original's drawn parts (replicas ticket-club/index.tsx): everything on the page is drawn in code.
// No hooks: these render on the server as well as inside the line's client island.

import type { ReactNode } from "react";
import { BARCODE, CLIP, DIAMOND, QR_BOX, TW } from "./geometry";
import { qrPath } from "./qr";
import s from "./ticket-club.module.css";

export const Asterisk = ({ size, color, w = 1.6 }: { size: number; color: string; w?: number }) => (
  <svg width={size} height={size} viewBox="-10 -10 20 20" className={s.svg} aria-hidden>
    <path d="M0-10V10M-10 0H10M-7.07-7.07L7.07 7.07M7.07-7.07L-7.07 7.07" stroke={color} strokeWidth={w} fill="none" />
  </svg>
);
const GLYPHS: Record<string, ReactNode> = {
  web: <><circle cx="12" cy="12" r="9.5" /><path d="M12 2.5a14 14 0 0 0 0 19 14 14 0 0 0 0-19M2.5 12h19" /></>,
  github: <><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></>,
  chat: <><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /><path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth="2.6" /></>,
  arrowSE: <path d="M5.5 5.5l13 13M18.5 7.5v11h-11" />,
  sliders: <path d="M3 8h18M3 16h18M15.5 5v6M8.5 13v6" />,
  refresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6l2.5 2.5" /><path d="M20.5 3.5v5h-5" /></>,
  down: <path d="M12 5v14M6.5 13.5L12 19l5.5-5.5" />,
  check: <path d="M4.5 12.5l5 5L20 7" />,
  clip: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01" /></>,
  trash: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />,
};
export const Glyph = ({ name, size, color, w = 1.5 }: { name: string; size: number; color: string; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={s.svg} aria-hidden fill="none" stroke={color}
    strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{GLYPHS[name]}</svg>
);
/** "↗" as set in the header: a stem with a solid head. */
export const ArrowNE = ({ color }: { color: string }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" className={s.svg} aria-hidden>
    <path d="M1.2 8.8L6.6 3.4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3.4 1h5.6v5.6z" fill={color} />
  </svg>
);
/** "×" that takes the place of "↗" while the edition is open. */
export const CrossIcon = ({ color }: { color: string }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" className={s.svg} aria-hidden>
    <path d="M1.6 1.6l6.8 6.8M8.4 1.6L1.6 8.4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
/** "↳" of the hint row. */
export const HookArrow = ({ color }: { color: string }) => (
  <svg width="14" height="20" viewBox="0 0 14 20" className={s.svg} aria-hidden>
    <path d="M2.5 1v13.5h9M8 11l3.5 3.5L8 18" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="square" />
  </svg>
);

// the diamond's two paths, built once
const DIAMOND_D = (() => {
  const runs = { R: "", C: "" };
  DIAMOND.rows.forEach((r, y) => {
    let x = 0;
    while (x < r.length) {
      const ch = r[x];
      let e = x;
      while (e < r.length && r[e] === ch) e++;
      if (ch !== ".") {
        runs.R += `M${x} ${y}h${e - x}v1h${x - e}z`;
        if (ch === "C") runs.C += `M${x} ${y}h${e - x}v1h${x - e}z`;
      }
      x = e;
    }
  });
  return runs;
})();
/** The pixel-art diamond: a red field with the cyan pattern on top. */
export const Diamond = ({ light }: { light?: boolean }) => {
  const { rows, w, h } = DIAMOND;
  const { red, cyan } = light ? DIAMOND.light : DIAMOND.dark;
  return (
    <svg className={s.svg} width={w} height={h} viewBox={`0 0 ${rows[0].length} ${rows.length}`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden>
      <path d={DIAMOND_D.R} fill={red} />
      <path d={DIAMOND_D.C} fill={cyan} />
    </svg>
  );
};
const BARCODE_D = BARCODE.bars.map(([c, w]) => {
  const bw = w ? BARCODE.wide : BARCODE.thin;
  return `M${(c - bw / 2).toFixed(2)} 0h${bw}v${BARCODE.h}h${-bw}z`;
}).join("");
/** Barcode under the link. */
export const Barcode = ({ color }: { color: string }) => (
  <svg className={s.svg} width={TW} height={BARCODE.h} viewBox={`0 0 ${TW} ${BARCODE.h}`} aria-hidden><path d={BARCODE_D} fill={color} /></svg>
);
/** The metal clip that holds a ticket on the line (its gradients are defined once, by <ClipDefs />). */
export const Clip = () => (
  <svg className={s.clip} width={CLIP.w} height={CLIP.h} viewBox="0 0 18.5 49" aria-hidden
    style={{ left: CLIP.u, top: CLIP.v, transform: `rotate(${CLIP.tilt}deg)` }}>
    <rect x="0.25" y="0.25" width="18" height="48.5" rx="4.6" fill="url(#tc-metal)" />
    <rect x="4.6" y="5" width="9.4" height="38.6" rx="4.2" fill="url(#tc-inner)" stroke="rgba(78,78,64,0.5)" strokeWidth="0.8" />
    <path d="M7.2 9.5v29" stroke="rgba(255,255,244,0.7)" strokeWidth="1.1" strokeLinecap="round" />
    <rect x="0.25" y="0.25" width="18" height="48.5" rx="4.6" fill="url(#tc-shine)" stroke="rgba(70,62,50,0.35)" strokeWidth="0.5" />
  </svg>
);
export const ClipDefs = () => (
  <svg width="0" height="0" className={s.defs} aria-hidden>
    <defs>
      <linearGradient id="tc-metal" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="rgb(204,202,184)" />
        <stop offset="0.12" stopColor="rgb(170,171,158)" />
        <stop offset="0.38" stopColor="rgb(226,226,206)" />
        <stop offset="0.6" stopColor="rgb(170,170,154)" />
        <stop offset="0.76" stopColor="rgb(112,118,104)" />
        <stop offset="0.88" stopColor="rgb(196,195,170)" />
        <stop offset="1" stopColor="rgb(120,114,98)" />
      </linearGradient>
      <linearGradient id="tc-inner" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="rgb(186,186,170)" />
        <stop offset="0.35" stopColor="rgb(236,236,218)" />
        <stop offset="1" stopColor="rgb(160,160,144)" />
      </linearGradient>
      <linearGradient id="tc-shine" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
        <stop offset="0.25" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.8" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.16" />
      </linearGradient>
    </defs>
  </svg>
);
/** The ticket's QR code (cyan modules on a dark card) of the link it hands out. */
export const QrCard = ({ text }: { text: string }) => {
  const q = qrPath(text);
  const { u, v, s: side, code, dash } = QR_BOX;
  return (
    <>
      <div className={s.qrBox} style={{ left: u, top: v, width: side, height: side }} />
      <svg className={s.abs} style={{ left: code.u, top: code.v, width: code.s, height: code.s }} viewBox={`0 0 ${q.size} ${q.size}`} shapeRendering="crispEdges" aria-hidden>
        <path d={q.d} fill="rgb(178, 226, 218)" />
      </svg>
      <svg className={s.abs} style={{ left: dash.u, top: dash.v, width: dash.w, height: 1 }} viewBox="0 0 16 1" aria-hidden>
        <path d="M0 .5h16" stroke="rgba(150, 190, 180, 0.55)" strokeWidth="0.8" strokeDasharray="2.2 2.4" />
      </svg>
    </>
  );
};
/** The red backdrop: a warm gradient, two wide sheets with soft shadows along their arcs and a fold. */
export const Backdrop = () => (
  <svg className={s.backdrop} viewBox="0 0 1500 807" preserveAspectRatio="xMidYMid slice" aria-hidden>
    <defs>
      <linearGradient id="tc-b" x1="0" y1="0" x2="1500" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="rgb(206,26,18)" /><stop offset="0.2" stopColor="rgb(221,32,20)" /><stop offset="0.4" stopColor="rgb(234,40,23)" />
        <stop offset="0.6" stopColor="rgb(241,49,28)" /><stop offset="0.72" stopColor="rgb(243,52,30)" /><stop offset="0.87" stopColor="rgb(241,50,29)" /><stop offset="1" stopColor="rgb(236,43,27)" />
      </linearGradient>
      <radialGradient id="tc-a1" cx="1288" cy="1739" r="1530" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="rgb(255,95,60)" stopOpacity="0.02" /><stop offset="0.8" stopColor="rgb(255,95,60)" stopOpacity="0.08" />
        <stop offset="0.9294" stopColor="rgb(255,95,60)" stopOpacity="0.16" />
        <stop offset="0.9296" stopColor="rgb(150,20,10)" stopOpacity="0.13" /><stop offset="1" stopColor="rgb(150,20,10)" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="tc-a2" cx="1701" cy="2038" r="1500" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="rgb(255,95,60)" stopOpacity="0.12" /><stop offset="0.936" stopColor="rgb(255,95,60)" stopOpacity="0.12" />
        <stop offset="0.9362" stopColor="rgb(150,20,10)" stopOpacity="0.12" /><stop offset="1" stopColor="rgb(150,20,10)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="tc-v" x1="0" y1="380" x2="0" y2="807" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="rgb(120,0,0)" stopOpacity="0" /><stop offset="1" stopColor="rgb(120,0,0)" stopOpacity="0.06" />
      </linearGradient>
      <radialGradient id="tc-c" cx="0" cy="807" r="560" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="rgb(90,0,0)" stopOpacity="0.2" /><stop offset="1" stopColor="rgb(90,0,0)" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="tc-d" cx="520" cy="900" r="520" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="rgb(120,0,0)" stopOpacity="0.08" /><stop offset="1" stopColor="rgb(120,0,0)" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="-1500" y="-800" width="4500" height="2400" fill="url(#tc-b)" />
    <path d="M1428.5 -800L266.6 2400H3000V-800z" fill="rgb(220,0,10)" fillOpacity="0.09" />
    <path d="M1428.5 -800L266.6 2400" stroke="rgb(150,20,10)" strokeOpacity="0.14" strokeWidth="2.5" />
    <rect x="-1500" y="-800" width="4500" height="2400" fill="url(#tc-a1)" />
    <rect x="-1500" y="-800" width="4500" height="2400" fill="url(#tc-a2)" />
    <rect x="-1500" y="-800" width="4500" height="2400" fill="url(#tc-v)" />
    <rect x="-1500" y="-800" width="4500" height="2400" fill="url(#tc-c)" />
    <rect x="-1500" y="-800" width="4500" height="2400" fill="url(#tc-d)" />
  </svg>
);
