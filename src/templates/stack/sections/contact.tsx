import type { CSSProperties } from "react";
import type { StackData } from "../data";
import { Divider } from "../parts/divider";
import { ArrowUpRight, Pen } from "../parts/icons";
import { TakeCard } from "./take-card";
import s from "../stack.module.css";
import k from "./contact.module.css";

/** Contact: a small stack of calling cards, and a slip of paper with a closing quote. */
export function Contact({ data, slot }: { data: StackData; slot: number }) {
  const { card, ending, labels, tabs } = data;
  if (!card) return null;
  const face = (
    <>
      <p className={k.cardName}>{card.name}</p>
      {card.role && <p className={k.cardRole}>{card.role}</p>}
      <div className={k.cardBody}>
        {card.email && (
          <a className={k.email} href={`mailto:${card.email}`}>
            {card.email}
          </a>
        )}
        {(card.links.length > 0 || card.resume) && (
          <ul className={k.links}>
            {card.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.label}
                  <ArrowUpRight />
                </a>
              </li>
            ))}
            {card.resume && (
              <li>
                <a
                  href={card.resume.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {card.resume.label}
                  <ArrowUpRight />
                </a>
              </li>
            )}
          </ul>
        )}
      </div>
      {card.place && <p className={k.cardPlace}>{card.place}</p>}
    </>
  );
  return (
    <section id="contact" className={s.section} aria-labelledby="contact-title">
      <Divider
        slot={slot}
        slots={tabs.length}
        tint="contact"
        id="contact-title"
      >
        {labels.contact}
      </Divider>
      <div className={k.layout}>
        <div className={k.stack} data-land="">
          <div className={k.under} aria-hidden="true" />
          <div className={k.under} aria-hidden="true" />
          <TakeCard
            className={k.card}
            email={card.email}
            labels={{ copy: labels.copy, copied: labels.copied }}
            actions={
              card.email ? (
                <a className={s.button} href={`mailto:${card.email}`}>
                  <Pen />
                  {labels.write}
                </a>
              ) : null
            }
          >
            {face}
          </TakeCard>
        </div>
        {ending && (
          <figure
            className={k.slip}
            data-land=""
            style={{ "--land-delay": "0.15s" } as CSSProperties}
          >
            <div className={k.paper}>
              <blockquote className={k.quote}>
                <p>{ending.quote}</p>
              </blockquote>
              {ending.author && (
                <figcaption className={k.author}>{ending.author}</figcaption>
              )}
            </div>
          </figure>
        )}
      </div>
    </section>
  );
}
