import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

export function ArrowIcon(props: Props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function NorthEastIcon(props: Props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}

export function GlobeIcon(props: Props) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
      {...props}
    >
      <circle cx="16" cy="16" r="13" />
      <ellipse cx="16" cy="16" rx="6.5" ry="13" />
      <path d="M3 16h26M5.5 8.5h21M5.5 23.5h21" />
    </svg>
  );
}

export function PlaybackIcon({
  paused,
  ...props
}: Props & { paused: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      {paused ? (
        <path d="m7 4 9 6-9 6V4Z" fill="currentColor" />
      ) : (
        <path d="M6 4h2v12H6zm6 0h2v12h-2z" fill="currentColor" />
      )}
    </svg>
  );
}
