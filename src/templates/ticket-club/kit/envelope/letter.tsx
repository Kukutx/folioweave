// A handwritten-title letter on a sheet of paper. The author's paragraphs flow on the sheet; the
// highlighted phrases are redrawn left → right by LetterStack (data-sweep). Theme: --font-hand (title),
// --font-serif (body), --letter-ink. (The original kept its sample's recorded line breaks where the sheet
// was wide enough; an author's own text has none, so it flows at every width.)
import type { CSSProperties } from "react";
import type { LetterContent } from "./content";
import s from "./letter.module.css";

export type LetterProps = LetterContent & { className?: string; style?: CSSProperties };

export function Letter(props: LetterProps) {
  return (
    <article className={`${s.letter} ${props.className ?? ""}`} style={props.style}>
      <h2 className={s.title}>{props.title}</h2>
      {props.paragraphs.map((runs, i) => (
        <p key={i} className={s.para}>
          {runs.map((r, j) => !r.mark ? <span key={j}>{r.text}</span>
            : r.text.length > 36 ? <mark key={j} className={s.markLong}>{r.text}</mark>
              : <mark key={j} data-sweep className={s.mark}>{r.text}</mark>)}
        </p>
      ))}
    </article>
  );
}
