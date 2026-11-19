// The stamp cluster on the envelope (SINGAPORE shophouses, RAINY DAYS, a heart, the POST WITH LOVE
// postmark and the wavy cancellation), drawn in SVG in a 201 × 158 box. Text comes in as props.
// Theme: --font-stamp (lettering), else --font-sans.
import { useId, type CSSProperties } from "react";

export type StampLabels = { city: string; caption: string; rainy: string; post: string; withLove: string };
export const stampLabels: StampLabels = { city: "SINGAPORE", caption: "SHOPHOUSES", rainy: "RAINY DAYS", post: "POST", withLove: "WITH LOVE" };

const INK = "rgb(52, 48, 40)";
const FONT = "var(--font-stamp, var(--font-sans, system-ui, sans-serif))";

/** A white stamp with perforated edges (holes every `pitch`), its coloured field inset by `inset`. */
function Perforated({ id, w, h, inset, fill, pitch = 4.4, r = 1.35 }: { id: string; w: number; h: number; inset: number; fill: string; pitch?: number; r?: number }) {
  const holes: string[] = [];
  const nx = Math.round(w / pitch), ny = Math.round(h / pitch);
  const px = w / nx, py = h / ny;
  for (let i = 0; i <= nx; i++) holes.push(`M${i * px - r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0M${i * px - r} ${h}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`);
  for (let j = 1; j < ny; j++) holes.push(`M${-r} ${j * py}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0M${w - r} ${j * py}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`);
  return (
    <>
      <mask id={id} maskUnits="userSpaceOnUse" x={-2} y={-2} width={w + 4} height={h + 4}>
        <rect width={w} height={h} fill="#fff" />
        <path d={holes.join("")} fill="#000" />
      </mask>
      <g mask={`url(#${id})`}>
        <rect width={w} height={h} fill="rgb(250, 248, 238)" />
        <rect x={inset} y={inset} width={w - 2 * inset} height={h - 2 * inset} fill={fill} />
      </g>
    </>
  );
}

export function Stamps({ labels, className, style }: { labels?: Partial<StampLabels>; className?: string; style?: CSSProperties }) {
  const L = { ...stampLabels, ...labels };
  const u = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const sh = `${u}sh`, ink = `${u}ink`;
  const outline = { stroke: "rgb(74, 60, 46)", strokeWidth: 0.4 };
  const win = (cx: number) => (
    <g key={cx}>
      <path d={`M${cx - 4.45} 45.5V37.75a4.45 4.45 0 0 1 8.9 0V45.5z`} fill="rgb(38, 107, 95)" {...outline} />
      <path d={`M${cx} 33.4V45.5M${cx - 4.45} 39.5H${cx + 4.45}`} stroke="rgb(236, 230, 210)" strokeWidth={0.55} />
    </g>
  );
  const door = (cx: number) => <path key={cx} d={`M${cx - 6.1} 65.3V57.7a6.1 6.1 0 0 1 12.2 0V65.3z`} fill="rgb(30, 92, 78)" />;
  const waves = [[79.7, 63.6, 69], [80.5, 69.4, 69], [82, 76.6, 70], [84, 83, 70]].map(([x, y, len]) => {
    let d = `M${x} ${y}`;
    for (let i = 0; i < len / 5; i++) d += `q2.5 ${i % 2 ? 1.6 : -1.6} 5 0`;
    return d;
  }).join("");
  return (
    <svg className={className} style={style} width="201" height="158" viewBox="0 0 201 158" aria-hidden>
      <defs>
        <filter id={sh} x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="0.7" stdDeviation="0.7" floodColor="rgb(70, 56, 30)" floodOpacity="0.28" />
        </filter>
        {/* worn ink: the stamp's lines break up a little */}
        <filter id={ink} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.75" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
      </defs>
      {/* SINGAPORE: the shophouses */}
      <g transform="translate(13 12) rotate(-0.5 35.5 38.5)" filter={`url(#${sh})`}>
        <Perforated id={`${u}a`} w={71} h={77} inset={5} fill="rgb(167, 215, 208)" />
        <text x="35.6" y="15.9" textAnchor="middle" fontFamily={FONT} fontSize="7.1" fontWeight="700" letterSpacing="0.55" fill="rgb(30, 74, 68)">{L.city}</text>
        <path d="M18.2 28.4L36.4 18.9L54.4 28.4z" fill="rgb(168, 62, 50)" />
        <rect x="14.6" y="28" width="43.9" height="4.6" fill="rgb(236, 224, 198)" {...outline} />
        <rect x="16.9" y="32.6" width="39.5" height="14" fill="rgb(240, 232, 210)" {...outline} />
        {[26.3, 37, 47.6].map(win)}
        <rect x="16.5" y="46.6" width="41.2" height="3.6" fill="rgb(228, 215, 188)" {...outline} />
        <rect x="18.1" y="50.2" width="38.3" height="15.1" fill="rgb(240, 232, 210)" {...outline} />
        {[28, 47.5].map(door)}
        <text x="37.6" y="70.1" textAnchor="middle" fontFamily={FONT} fontSize="3.6" fontWeight="700" letterSpacing="0.3" fill="rgb(30, 74, 68)">{L.caption}</text>
      </g>
      {/* RAINY DAYS: the umbrella */}
      <g transform="translate(105 9) rotate(0.8 41 37.5)" filter={`url(#${sh})`}>
        <Perforated id={`${u}b`} w={82} h={75} inset={4.6} fill="rgb(218, 207, 172)" />
        <text x="40.6" y="17.6" textAnchor="middle" fontFamily={FONT} fontSize="5.7" fontWeight="700" letterSpacing="0.45" fill="rgb(86, 82, 58)">{L.rainy}</text>
        <g fill="none" stroke="rgb(36, 70, 58)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.4 45.2A24.4 21 0 0 1 64.2 45.2z" />
          <path d="M39.8 24.4V62.6a3.8 3.8 0 0 1-7.6 0" />
        </g>
      </g>
      {/* the heart */}
      <g transform="translate(99.5 108.6) rotate(-6.5)" filter={`url(#${sh})`}>
        <g transform="translate(-22.2 -31.2)">
          <Perforated id={`${u}c`} w={44.4} h={62.4} inset={4.2} fill="rgb(241, 191, 203)" pitch={4.3} />
          <rect x="7.4" y="7.4" width="29.6" height="47.6" fill="none" stroke="rgb(252, 228, 234)" strokeWidth="0.6" />
        </g>
        <path d="M0 11.2C-4 6.6-11.6 1.6-11.6-4.8-11.6-9.6-8.4-12-5.4-12-2.8-12-0.8-10.4 0-8.2 0.8-10.4 2.8-12 5.4-12 8.4-12 11.6-9.6 11.6-4.8 11.6 1.6 4 6.6 0 11.2z"
          fill="rgb(246, 206, 216)" stroke="rgb(196, 48, 82)" strokeWidth="1.9" strokeLinejoin="round" />
      </g>
      {/* POST WITH LOVE + the wavy cancellation */}
      <g filter={`url(#${ink})`} opacity="0.88">
        <circle cx="41.5" cy="109.6" r="28.6" fill="none" stroke={INK} strokeWidth="0.95" />
        <circle cx="41.5" cy="109.6" r="25.7" fill="none" stroke={INK} strokeWidth="0.75" />
        <g transform="rotate(-8 41.5 109.6)" fill={INK} fontFamily={FONT} fontWeight="700" textAnchor="middle">
          <text x="41.5" y="108.4" fontSize="8.1" letterSpacing="1.5">{L.post}</text>
          <text x="42" y="117.6" fontSize="4.5" letterSpacing="0.55">{L.withLove}</text>
        </g>
        <path d={waves} fill="none" stroke={INK} strokeWidth="0.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}
