import type { Rich } from "../copy";

/** Copy with bold runs and links; links open in a new tab. */
export function RichText({ value, linkClassName }: { value: Rich; linkClassName: string }) {
  return value.map((part, index) =>
    typeof part === "string" ? (
      part
    ) : "b" in part ? (
      <b key={index}>{part.b}</b>
    ) : (
      <a
        key={index}
        href={part.href}
        target="_blank"
        rel="noreferrer noopener"
        className={linkClassName}
      >
        {part.link}
      </a>
    ),
  );
}
