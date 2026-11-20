import type { StackData } from "../data";
import { Divider } from "../parts/divider";
import { imageSet } from "../parts/image";
import { Deck, type DeckView } from "./deck";
import s from "../stack.module.css";

/** Work: the projects as mounted boards in one deck, with the deck's index beside it. */
export function Work({ data, slot }: { data: StackData; slot: number }) {
  const { deck, labels, tabs } = data;
  const cards: DeckView[] = deck.map((card) => ({
    ...card,
    pictures: card.pictures.map((picture) =>
      card.screens
        ? imageSet(picture, "(max-width: 640px) 30vw, 220px")
        : imageSet(picture, "(max-width: 1040px) calc(100vw - 64px), 680px"),
    ),
  }));
  return (
    <section id="work" className={s.section} aria-labelledby="work-title">
      <Divider slot={slot} slots={tabs.length} tint="work" id="work-title">
        {labels.work}
      </Divider>
      <div className={s.wide} data-land="">
        <Deck
          cards={cards}
          labels={{
            previous: labels.previous,
            next: labels.next,
            turnOver: labels.turnOver,
            turnBack: labels.turnBack,
            work: labels.work,
          }}
        />
      </div>
    </section>
  );
}
