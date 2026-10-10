const paths = {
  play: "M8 4.5 20 12 8 19.5z",
  pause: "M6 4h4v16H6zM14 4h4v16h-4z",
  previous: "m18 5-10 7 10 7zM5 5v14",
  next: "m6 5 10 7-10 7zM19 5v14",
  list: "M8 6h12M8 12h12M8 18h7M3 6h.1M3 12h.1M3 18h.1",
  volume: "M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14",
  muted: "M11 5 6 9H3v6h3l5 4zM16 9l6 6m0-6-6 6",
  repeat: "m16 3 4 4-4 4M4 11V7h16M8 21l-4-4 4-4m12 0v4H4",
  note: "M10 17V5l10-2v12M10 9l10-2M10 18a3 2 0 1 1-6 0 3 2 0 1 1 6 0M20 16a3 2 0 1 1-6 0 3 2 0 1 1 6 0",
  singleNote: "M12 17V4c1 4 7 3 6 8M12 18a3 2 0 1 1-6 0 3 2 0 1 1 6 0",
  chevronsUp: "M3 10 12 4l9 6v3l-9-6-9 6zM3 18 12 12l9 6v3l-9-6-9 6z",
};
export function MusicIcon({
  name,
  className,
}: {
  name: keyof typeof paths;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}
