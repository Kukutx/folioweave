import { FINISHES, Gradient, type Finish } from "./finishes";

/** Hardware for the small badge, in one piece: 24 × 34, pivot at top centre. */
export function MiniHardware({
  id,
  finish,
  strap,
}: {
  id: string;
  finish: Finish;
  strap: string;
}) {
  const tone = FINISHES[finish];
  return (
    <svg viewBox="-12 0 24 34" aria-hidden="true" focusable="false">
      <defs>
        <Gradient id={`${id}-ms`} stops={tone.sleeve} />
        <Gradient id={`${id}-mm`} stops={tone.metal} />
      </defs>
      <rect
        x={-8}
        y={10}
        width={16}
        height={5}
        rx={2.4}
        fill="none"
        stroke={`url(#${id}-mm)`}
        strokeWidth={1.6}
      />
      <path d="M-5 7 H5 L4.6 12 Q0 13 -4.6 12 Z" fill={strap} />
      <rect
        x={-6}
        y={0}
        width={12}
        height={8}
        rx={1.2}
        fill={`url(#${id}-ms)`}
      />
      <path
        d="M0 15 V18 M-1.6 18.5 H1.6 M0 19 C-3 23 -3 29 -1.6 31 C-0.6 32.6 1.8 32.4 2 30 M1.2 20.5 L1.8 30"
        fill="none"
        stroke={`url(#${id}-mm)`}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}
