import type { SVGProps } from "react";

// Drawn strokes, 16 px, in the current ink.
const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export const ArrowUpRight = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M5 11 11 5M6 5h5v5" />
  </svg>
);
export const ArrowLeft = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M13 8H3M7 4 3 8l4 4" />
  </svg>
);
export const ArrowRight = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);
export const ArrowUp = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M8 13V3M4 7l4-4 4 4" />
  </svg>
);
export const Turn = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M2.5 8a5.5 5.5 0 0 1 9.6-3.7M13.5 8a5.5 5.5 0 0 1-9.6 3.7" />
    <path d="M12.4 1.8v2.8H9.6M3.6 14.2v-2.8h2.8" />
  </svg>
);
export const Copy = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
    <path d="M10.5 3.5v-1h-8v8h1" />
  </svg>
);
export const Pen = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="m10.5 2.5 3 3L6 13H3v-3z" />
  </svg>
);
export const Spread = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <rect x="2" y="2" width="5" height="5" rx="0.5" />
    <rect x="9" y="2" width="5" height="5" rx="0.5" />
    <rect x="2" y="9" width="5" height="5" rx="0.5" />
    <rect x="9" y="9" width="5" height="5" rx="0.5" />
  </svg>
);
export const Pile = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <rect
      x="3.5"
      y="4.5"
      width="8"
      height="9"
      rx="0.5"
      transform="rotate(-8 7.5 9)"
    />
    <rect
      x="4.5"
      y="2.5"
      width="8"
      height="9"
      rx="0.5"
      transform="rotate(6 8.5 7)"
    />
  </svg>
);
