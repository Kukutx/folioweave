"use client";

import {
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import type { DeckCard } from "../data";
import type { ImageSet } from "../parts/image";
import { ArrowLeft, ArrowRight, ArrowUpRight, Turn } from "../parts/icons";
import { usePile } from "../parts/pile";
import s from "../stack.module.css";
import d from "./deck.module.css";

export type DeckView = Omit<DeckCard, "pictures"> & { pictures: ImageSet[] };
type Labels = {
  previous: string;
  next: string;
  turnOver: string;
  turnBack: string;
  work: string;
};

const OUT = { translate: "-64% -4%", rotate: "-9deg" };
const subscribeNothing = () => () => {};

function Photo({ card }: { card: DeckView }) {
  if (card.screens)
    return (
      <div className={d.screens}>
        {card.pictures.map((picture) => (
          <img
            key={picture.src}
            src={picture.src}
            srcSet={picture.srcSet}
            sizes={picture.sizes}
            width={picture.width}
            height={picture.height}
            alt={picture.alt}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ))}
      </div>
    );
  const picture = card.pictures[0];
  if (!picture) return <div className={d.blank} aria-hidden="true" />;
  return (
    <picture>
      {picture.mobile && (
        <source
          media={picture.mobile.media}
          srcSet={picture.mobile.srcSet}
          sizes={picture.sizes}
          width={picture.mobile.width}
          height={picture.mobile.height}
        />
      )}
      <img
        src={picture.src}
        srcSet={picture.srcSet}
        sizes={picture.sizes}
        width={picture.width}
        height={picture.height}
        alt={picture.alt}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}

/**
 * The projects as a deck of mounted boards. The top board shows its picture; turned over,
 * its back carries the description and the links. "Next" pulls the top board out and tucks
 * it under the deck (so does throwing it), "Previous" pulls the bottom one out and lays it
 * on top, and the index beside the deck brings any board to the top. A link to
 * `#work-<id>` elsewhere on the page does the same. Without JavaScript the boards lie one
 * after another, both sides showing.
 */
export function Deck({ cards, labels }: { cards: DeckView[]; labels: Labels }) {
  const [turnedCard, setTurnedCard] = useState<number | null>(null);
  const [lastTop, setLastTop] = useState(0);
  const [touched, setTouched] = useState(false);
  // false while hydrating, true after: the hidden boards become inert only once the deck works
  const live = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const pile = usePile(cards.length, {
    out: OUT,
    onTap: () => setTurnedCard((card) => (card === pile.top ? null : pile.top)),
  });
  const top = pile.top;
  const count = cards.length;
  const turned = turnedCard === top;
  if (top !== lastTop) {
    // a new board on top: announce it (only after the visitor moved the deck)
    setLastTop(top);
    setTouched(true);
  }
  const bring = useEffectEvent((index: number) => pile.toFront(index));
  // a link to one of the boards brings it to the top
  useEffect(() => {
    const follow = () => {
      const match = /^#work-(.+)$/.exec(
        decodeURIComponent(window.location.hash),
      );
      const index = match
        ? cards.findIndex((card) => card.id === match[1])
        : -1;
      if (index >= 0) bring(index);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [cards]);
  const toggle = () => setTurnedCard(turned ? null : top);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowRight") pile.toBack();
    else if (event.key === "ArrowLeft") pile.previous();
    else return;
    event.preventDefault();
  };

  const current = cards[top];
  return (
    <div
      className={d.deck}
      data-live={live ? "" : undefined}
      onKeyDown={count > 1 ? onKeyDown : undefined}
    >
      <div className={d.table}>
        <ol className={d.pile} aria-label={labels.work}>
          {cards.map((card, i) => {
            const p = pile.order.indexOf(i);
            const isTop = p === 0;
            const flipped = isTop && turned;
            return (
              <li
                key={card.id}
                id={`work-${card.id}`}
                ref={pile.ref(i)}
                className={d.card}
                data-p={Math.min(p, 3)}
                data-moving={pile.moving === i ? "" : undefined}
                data-turned={flipped ? "" : undefined}
                style={{ zIndex: count - p } as CSSProperties}
                inert={live && !isTop}
                {...(isTop ? pile.handlers : {})}
              >
                <div className={d.flip}>
                  <div className={d.front} inert={live && flipped}>
                    <div
                      className={d.photo}
                      data-screens={card.screens ? "" : undefined}
                    >
                      <Photo card={card} />
                      {card.badge && (
                        <span className={d.badge} data-tone={card.badge.tone}>
                          {card.badge.text}
                        </span>
                      )}
                    </div>
                    <div className={d.caption}>
                      <h3 className={d.name}>
                        {card.icon && (
                          <img
                            src={card.icon}
                            alt=""
                            width={28}
                            height={28}
                            loading="lazy"
                          />
                        )}
                        {card.name}
                      </h3>
                      <span className={d.date}>{card.date}</span>
                    </div>
                  </div>
                  <div className={d.back} inert={live && !flipped}>
                    <div className={d.backHead}>
                      <p className={d.backName}>{card.name}</p>
                      <span className={d.date}>{card.date}</span>
                    </div>
                    <p className={d.description}>{card.description}</p>
                    {card.badge &&
                      (card.badge.href ? (
                        <a
                          className={d.backBadge}
                          href={card.badge.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {card.badge.text}
                          <ArrowUpRight />
                        </a>
                      ) : (
                        <p className={d.backBadge}>{card.badge.text}</p>
                      ))}
                    {card.actions.length > 0 && (
                      <ul className={d.actions}>
                        {card.actions.map((action) => (
                          <li key={action.href}>
                            <a
                              className={s.ink}
                              href={action.href}
                              {...(action.newTab
                                ? {
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                  }
                                : {})}
                            >
                              {action.label}
                              <ArrowUpRight />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className={d.controls}>
          {count > 1 && (
            <button
              type="button"
              className={s.button}
              onClick={pile.previous}
              aria-label={labels.previous}
            >
              <ArrowLeft />
            </button>
          )}
          <span className={d.counter} aria-hidden="true">
            {String(top + 1).padStart(2, "0")} /{" "}
            {String(count).padStart(2, "0")}
          </span>
          {count > 1 && (
            <button
              type="button"
              className={s.button}
              onClick={pile.toBack}
              aria-label={labels.next}
            >
              <ArrowRight />
            </button>
          )}
          <button
            type="button"
            className={`${s.button} ${d.turn}`}
            aria-pressed={turned}
            onClick={toggle}
          >
            <Turn />
            {turned ? labels.turnBack : labels.turnOver}
          </button>
        </div>
      </div>
      {count > 1 && (
        <ol className={d.index}>
          {cards.map((card, i) => (
            <li key={card.id}>
              <button
                type="button"
                className={d.entry}
                aria-current={i === top ? "true" : undefined}
                onClick={() => pile.toFront(i)}
              >
                <span className={d.entryNumber}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={d.entryName}>{card.name}</span>
                <span className={d.entryDate}>{card.date}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className={s.visuallyHidden} aria-live="polite">
        {touched && current ? `${current.name}, ${top + 1} / ${count}` : ""}
      </p>
    </div>
  );
}
