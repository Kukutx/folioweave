// The letter on a page of its own (/edition, renamed with the editionPath option): the same sealed
// envelope as on the home page, at an address that can be shared.

import { notFound } from "next/navigation";
import type { TemplateContext } from "@/core/contracts";
import { labelsOf, letterOf, plain } from "./data";
import { Letter } from "./letter";
import s from "./site.module.css";

export function describe(context: TemplateContext) {
  const labels = labelsOf(context);
  const first = letterOf(context)?.paragraphs[0];
  const text = first ? plain(first) : "";
  return {
    title: labels.letterTitle,
    description:
      text.length > 160
        ? `${text.slice(0, 157).trimEnd()}…`
        : text || undefined,
  };
}

export default function Edition({ context }: { context: TemplateContext }) {
  const letter = letterOf(context);
  if (!letter) notFound();
  const labels = labelsOf(context);
  return (
    <main id="main" className={s.main}>
      <section className={s.section} aria-labelledby="tc-letter">
        <header className={s.head}>
          <p className={`${s.mono} ${s.kicker}`}>{letter.from}</p>
          <h1 id="tc-letter" className={s.heading}>
            {labels.letterTitle}
          </h1>
        </header>
        <Letter letter={letter} />
      </section>
    </main>
  );
}
