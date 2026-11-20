import type { CSSProperties } from "react";
import type { StackData } from "../data";
import { Divider } from "../parts/divider";
import s from "../stack.module.css";
import a from "./about.module.css";

// small, fixed offsets: the cards were laid down by hand, not by a grid
const TILT = [-1.2, 0.9, -0.5, 1.4, -1.6, 0.6];
const SHIFT = [0, 1, 0.35, 0.8, 0.15, 0.6];

/** The story on a ruled card, the highlighted words marked over in yellow, then the
 * timeline as a run of index cards, newest on top. */
export function About({ data, slot }: { data: StackData; slot: number }) {
  const { story, cards, labels, tabs } = data;
  return (
    <section id="about" className={s.section} aria-labelledby="about-title">
      <Divider slot={slot} slots={tabs.length} tint="about" id="about-title">
        {labels.about}
      </Divider>
      {story.length > 0 && (
        <div className={a.story} data-land="">
          {story.map((paragraph, i) => (
            <p key={i}>
              {paragraph.map((part, j) => (
                <span key={j} className={a[part.tone]}>
                  {part.text}
                </span>
              ))}
            </p>
          ))}
        </div>
      )}
      {cards.length > 0 && (
        <ol className={a.cards}>
          {cards.map((card, i) => (
            <li
              key={`${card.year}-${i}`}
              className={a.card}
              data-land=""
              style={
                {
                  "--tilt": `${TILT[i % TILT.length]}deg`,
                  "--shift": SHIFT[i % SHIFT.length],
                  zIndex: i + 1,
                } as CSSProperties
              }
            >
              <div className={a.cardHead}>
                <span className={a.year}>{card.year}</span>
                {card.current && <span className={a.stamp}>{labels.now}</span>}
              </div>
              <h3 className={a.cardTitle}>{card.title}</h3>
              {card.text && <p className={a.cardText}>{card.text}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
