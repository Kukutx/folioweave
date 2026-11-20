import type { Part } from "./data";
import s from "./pond.module.css";

/** A line of the profile's rich text: names of published projects link to them. */
export function Parts({ parts }: { parts: Part[] }) {
  return parts.map((part, i) =>
    typeof part === "string" ? (
      part
    ) : part.href ? (
      <a key={i} className={s.link} href={part.href}>
        {part.text}
      </a>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}
