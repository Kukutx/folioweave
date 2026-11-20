import type { Segment } from "../data";
import s from "../stack.module.css";

/** Profile text with its brand marks: a small square logo before the name, linked to the
 * project's card in the deck when the brand names a project on the page. */
export function Rich({ segments }: { segments: readonly Segment[] }) {
  return segments.map((part, i) => {
    if ("text" in part) return <span key={i}>{part.text}</span>;
    const { name, icon, href } = part.brand;
    const inner = (
      <>
        <img
          src={icon}
          alt=""
          width={16}
          height={16}
          loading="lazy"
          decoding="async"
        />
        {name}
      </>
    );
    return href ? (
      <a key={i} className={s.brand} href={href}>
        {inner}
      </a>
    ) : (
      <span key={i} className={s.brand}>
        {inner}
      </span>
    );
  });
}
