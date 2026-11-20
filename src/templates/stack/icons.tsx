// Small interface glyphs of the page, drawn as SVG (the original's, plus GitHub, web and mail in the
// same weights for the profile's other links).

type P = { size?: number; className?: string };

export function Clock({ size = 15, className }: P) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Copy({ size = 15, className }: P) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
    </svg>
  );
}

export function Check({ size = 15, className }: P) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function XLogo({ size = 14, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="M3.2 3.2h5.4l12.2 17.6h-5.4zM20.2 3.2l-6.9 7.9M3.8 20.8l6.9-7.9"
      />
    </svg>
  );
}

export function LinkedIn({ size = 14, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="2.2" fill="currentColor" />
      <path
        fill="#fff"
        d="M6 9.6h2.7V18H6zM7.35 5.4a1.55 1.55 0 1 1 0 3.1 1.55 1.55 0 0 1 0-3.1zM10.4 9.6h2.6v1.15c.4-.75 1.35-1.4 2.75-1.4 2.8 0 3.3 1.8 3.3 4.2V18h-2.7v-4c0-1-.05-2.2-1.35-2.2-1.4 0-1.6 1.05-1.6 2.15V18h-2.7z"
      />
    </svg>
  );
}

export function Instagram({ size = 14, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="currentColor" />
      <circle cx="12" cy="12" r="4.2" stroke="#fff" strokeWidth="1.9" fill="none" />
      <circle cx="17.3" cy="6.7" r="1.15" fill="#fff" />
    </svg>
  );
}

export function ArrowUpRight({ size = 18, className }: P) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 14.5L14 4M5.5 3.5H14.5V12.5" />
    </svg>
  );
}

export function GitHub({ size = 14, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 1.8A10.2 10.2 0 0 0 8.8 21.7c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.3-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .9-.3 2.8 1a9.6 9.6 0 0 1 5.1 0c1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7.7.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10.2 10.2 0 0 0 12 1.8z" />
    </svg>
  );
}

export function Globe({ size = 14, className }: P) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" strokeLinejoin="round" />
    </svg>
  );
}

export function Mail({ size = 14, className }: P) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 7l8 6 8-6" strokeLinecap="round" />
    </svg>
  );
}
