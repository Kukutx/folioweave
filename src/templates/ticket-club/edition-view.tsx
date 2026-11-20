"use client";

// The edition's envelope (and, once it is torn open, the letter stack) under the page's header, as the
// original's Edition lays it out: on a wide screen scaled down (never up) to fit under the header; on a
// phone at its own size, the page scrolls. The stack's × and Escape go back to the line.

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Envelope, Letter, LetterStack } from "./kit/envelope";
import type { EnvelopeContent, LetterContent } from "./kit/envelope/content";
import env from "./kit/envelope/envelope.module.css";
import s from "./edition.module.css";

const FOLD = { anchor: 1 / 3 };

export function EditionView({ header, envelope, letter, stack }: {
  header: ReactNode;
  envelope: EnvelopeContent;
  letter: LetterContent;
  stack: { close: string; prev: string; next: string };
}) {
  const router = useRouter();
  const scroll = useRef<HTMLDivElement>(null);
  const fit = useRef<HTMLDivElement>(null);
  const fitIn = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) router.push("/"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    // on a wide screen the envelope and the letter are scaled down (never up) to fit under the header;
    // on a phone they keep their size and the page scrolls
    const sc = scroll.current!, outer = fit.current!, inner = fitIn.current!;
    const layout = () => {
      const head = outer.parentElement?.previousElementSibling as HTMLElement | null;
      const avail = window.innerHeight - (head ? head.getBoundingClientRect().bottom - sc.getBoundingClientRect().top : 0) - 24;
      const h = inner.offsetHeight;
      const f = sc.clientWidth < 700 || !h ? 1 : Math.max(0.6, Math.min(1, avail / h));
      inner.style.transform = f < 1 ? `scale(${f})` : "";
      outer.style.height = `${h * f}px`;
    };
    const ro = new ResizeObserver(layout);
    ro.observe(sc);
    ro.observe(inner);
    window.addEventListener("resize", layout);
    return () => { ro.disconnect(); window.removeEventListener("resize", layout); };
  }, []);

  return (
    <div ref={scroll} className={s.scroll}>
      {/* without JavaScript the envelope cannot be opened: the letter is shown as it lies in it, unfolded */}
      <noscript><style>{`.${env.layer}{display:none!important}.${env.content}{opacity:1!important}`}</style></noscript>
      {header}
      <div className={s.body}>
        <div ref={fit} className={s.fit}>
          <div ref={fitIn} className={s.fitIn}>
            <Envelope fold={FOLD} {...envelope}>
              <LetterStack onClose={() => router.push("/")} prepare labels={stack} pages={[{ content: <Letter {...letter} /> }]} />
            </Envelope>
          </div>
        </div>
      </div>
    </div>
  );
}
