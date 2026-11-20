"use client";

// The letter. A kraft envelope lies address side up, stamped with the author's portrait and postmarked
// in their city. Opening it (a click, Enter or Space) turns it over, breaks the wax seal with the
// author's initials, lifts the flap and draws the letter out; the letter then lies open on top of the
// envelope. With reduced motion it is simply open; without JavaScript the letter is shown under the
// envelope (see the <noscript> rule).

import { useEffect, useId, useRef, useState, type Ref } from "react";
import { flushSync } from "react-dom";
import type { LetterData } from "./data";
import e from "./letter.module.css";

type State = "sealed" | "opening" | "open";

const still = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const run = (
  el: Element | null,
  frames: Keyframe[],
  options: KeyframeAnimationOptions,
) =>
  el
    ? el
        .animate(frames, { fill: "forwards", ...options })
        .finished.catch(() => undefined)
    : Promise.resolve();

function Stamp({
  stamp,
  initials,
}: {
  stamp: LetterData["stamp"];
  initials: string;
}) {
  return (
    <span className={e.stamp}>
      <span className={e.stampFrame}>
        <span className={e.stampCity}>{stamp.city}</span>
        <span className={e.stampWindow}>
          {stamp.portrait ? (
            <img
              src={stamp.portrait}
              alt=""
              width={120}
              height={150}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className={e.stampInitials}>{initials}</span>
          )}
        </span>
        <span className={e.stampValue}>{stamp.year}</span>
      </span>
    </span>
  );
}

function Postmark({ ring: words, year }: { ring: string; year: string }) {
  const id = useId().replace(/:/g, "");
  const ring = `${words} ✦ `.toLocaleUpperCase();
  return (
    <svg className={e.postmark} viewBox="0 0 260 120" aria-hidden>
      <defs>
        <path
          id={`pm${id}`}
          d="M60 60m-41 0a41 41 0 1 1 82 0a41 41 0 1 1 -82 0"
        />
      </defs>
      <circle cx="60" cy="60" r="52" />
      <circle cx="60" cy="60" r="30" />
      <text className={e.postmarkRing}>
        <textPath
          href={`#pm${id}`}
          textLength="250"
          lengthAdjust="spacingAndGlyphs"
        >
          {ring}
        </textPath>
      </text>
      <text className={e.postmarkYear} x="60" y="67" textAnchor="middle">
        {year}
      </text>
      {[30, 46, 62, 78, 94].map((y) => (
        <path
          key={y}
          d={`M122 ${y}c11-8 22-8 33 0s22 8 33 0 22-8 33 0 22 8 33 0`}
        />
      ))}
    </svg>
  );
}

/** The back of the envelope: the flap, the seal on its point, the return address on the lower flaps. */
function Back({
  letter,
  opened,
  refs,
}: {
  letter: LetterData;
  opened?: boolean;
  refs?: {
    flap: Ref<HTMLSpanElement>;
    seal: Ref<HTMLSpanElement>;
    peek: Ref<HTMLSpanElement>;
  };
}) {
  return (
    <>
      <span className={e.inside} />
      <span
        ref={refs?.flap}
        className={`${e.flap} ${opened ? e.flapOpen : ""}`}
      />
      {!opened && <span ref={refs?.peek} className={e.peek} />}
      <span className={e.pocket}>
        <svg viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden>
          <path d="M0 100 L72 52 Q80 47 88 52 L160 100" />
          <path d="M0 0 L66 58M160 0 L94 58" />
        </svg>
        <span className={e.from}>
          {letter.from}
          {letter.returnAddress && <span>{letter.returnAddress}</span>}
        </span>
      </span>
      {!opened && (
        <span ref={refs?.seal} className={e.seal}>
          <span className={e.sealHalf}>{letter.initials}</span>
          <span className={e.sealHalf}>{letter.initials}</span>
        </span>
      )}
    </>
  );
}

function Words({ letter }: { letter: LetterData }) {
  return (
    <>
      <p className={e.place}>{letter.place}</p>
      <p className={e.greeting}>{letter.greeting}</p>
      {letter.paragraphs.map((p, i) => (
        <p key={i} className={e.para}>
          {p.map((s, j) => (
            <span key={j} className={s.tone ? e[s.tone] : undefined}>
              {s.text}
            </span>
          ))}
        </p>
      ))}
      <p className={e.sign}>{letter.signOff}</p>
      <p className={e.signature}>
        {letter.name}
        <svg viewBox="0 0 200 18" preserveAspectRatio="none" aria-hidden>
          <path d="M2 12c30-9 60-9 92-4s70 6 104-6" />
        </svg>
      </p>
    </>
  );
}

export function Letter({ letter }: { letter: LetterData }) {
  const [state, setState] = useState<State>("sealed");
  const id = useId();
  const card = useRef<HTMLSpanElement>(null);
  const flap = useRef<HTMLSpanElement>(null);
  const seal = useRef<HTMLSpanElement>(null);
  const peek = useRef<HTMLSpanElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    if (state === "open" && opened.current) {
      opened.current = false;
      sheet.current?.focus({ preventScroll: true });
    }
  }, [state]);

  const show = () => {
    opened.current = true;
    const commit = () => flushSync(() => setState("open"));
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (doc.startViewTransition && !still()) doc.startViewTransition(commit);
    else commit();
  };

  const openIt = async () => {
    if (state !== "sealed") return;
    if (still()) return show();
    setState("opening");
    const ease = "cubic-bezier(.55,.05,.3,1)";
    // turn it over
    await run(
      card.current,
      [
        { transform: "rotateY(0)" },
        { transform: "translateZ(40px) rotateY(90deg)", offset: 0.5 },
        { transform: "rotateY(180deg)" },
      ],
      { duration: 760, easing: ease },
    );
    // break the seal
    const halves = seal.current ? Array.from(seal.current.children) : [];
    await Promise.all(
      halves.map((h, i) =>
        run(
          h,
          [
            { transform: "none", opacity: 1 },
            {
              transform: `translate(${i ? 9 : -9}px, 7px) rotate(${i ? 16 : -16}deg)`,
              opacity: 0,
            },
          ],
          {
            duration: 300,
            easing: "cubic-bezier(.3,0,.6,1)",
          },
        ),
      ),
    );
    // lift the flap: in front of the letter until it stands up, behind it after
    await run(
      flap.current,
      [
        { transform: "perspective(900px) rotateX(0)" },
        { transform: "perspective(900px) rotateX(90deg)" },
      ],
      { duration: 260, easing: "cubic-bezier(.5,0,1,1)" },
    );
    flap.current?.classList.add(e.flapOpen);
    await run(
      flap.current,
      [
        { transform: "perspective(900px) rotateX(90deg)" },
        { transform: "perspective(900px) rotateX(180deg)" },
      ],
      { duration: 300, easing: "cubic-bezier(0,0,.4,1)" },
    );
    // draw the letter out
    await run(
      peek.current,
      [{ transform: "none" }, { transform: "translateY(-62%)" }],
      { duration: 620, easing: "cubic-bezier(.3,.7,.3,1)" },
    );
    show();
  };

  const isOpen = state === "open";
  return (
    <div className={e.wrap} data-state={state}>
      <noscript>
        <style>{`.${e.letter}[hidden]{display:block!important}.${e.hint}{display:none}`}</style>
      </noscript>
      {!isOpen && (
        <button
          type="button"
          className={e.envelope}
          aria-expanded={false}
          aria-controls={id}
          onClick={openIt}
        >
          <span className={e.scene} aria-hidden>
            <span ref={card} className={e.card}>
              <span className={e.face}>
                <Stamp stamp={letter.stamp} initials={letter.initials} />
                <Postmark
                  ring={letter.returnAddress || letter.stamp.city}
                  year={letter.stamp.year}
                />
                <span className={e.address}>
                  <span className={e.to}>{letter.to}</span>
                  <span className={e.toLine}>{letter.place}</span>
                </span>
              </span>
              <span className={`${e.face} ${e.back}`}>
                <Back letter={letter} refs={{ flap, seal, peek }} />
              </span>
            </span>
          </span>
          <span className={e.hint}>{letter.hint}</span>
        </button>
      )}
      <article
        ref={sheet}
        id={id}
        className={e.letter}
        hidden={!isOpen}
        tabIndex={-1}
      >
        <Words letter={letter} />
      </article>
      {isOpen && (
        <span className={e.tucked} aria-hidden>
          <span className={`${e.face} ${e.back} ${e.flat}`}>
            <Back letter={letter} opened />
          </span>
        </span>
      )}
    </div>
  );
}
