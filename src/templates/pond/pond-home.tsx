"use client";

// The pond home, as in the original: an ASCII koi pond fills the screen; click anywhere on the water (or focus it
// and press Enter) to drop food. The corner counter shows the koi and the pellets in the water, flashing bright on
// every change. The ink drop rests at the pond's edge: bottom right on the last line of text on wide pages, beside
// the motto on narrow ones; its eyes follow the pointer and pressing its body squashes it. The koi steer around
// the intro and the drop and swim faintly under the lines of text.
//
// One drop on screen: when the site's floating launcher (the same ink drop, as a button) is on the page, the pond's
// own drop gives way to it (pond.module.css, .drop).

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { InkBot } from "./kit/ink-bot";
import { KoiPond, type KoiPondStats } from "./kit/koi-pond";
import type { Part, PondData } from "./data";
import { Nav } from "./nav";
import { usePondTheme } from "./theme-toggle";
import s from "./pond.module.css";

const FISH = 10;

function Linked({ part }: { part: Part }) {
  if (typeof part === "string") return <>{part}</>;
  return part.href ? (
    <a className={s.link} href={part.href}>
      {part.text}
    </a>
  ) : (
    <span className={s.link}>{part.text}</span>
  );
}

export function PondHome({ data }: { data: PondData }) {
  const theme = usePondTheme();
  const [stats, setStats] = useState<KoiPondStats>({ fish: FISH, food: 0 });
  const [flash, setFlash] = useState(false);
  const [poke, setPoke] = useState(0);
  const raf = useRef(0);
  const introRef = useRef<HTMLElement>(null);
  const bioRef = useRef<HTMLDivElement>(null);
  const socialRef = useRef<HTMLParagraphElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const dropBodyRef = useRef<HTMLDivElement>(null);
  // the koi turn away from the bio, the links and the ink drop's body but swim right up to (and past) the motto;
  // under every line of text the pond is drawn only faintly, so it still shows between the lines
  const [avoid] = useState(() => [bioRef, socialRef, dropBodyRef]);
  const [dim] = useState(() => [navRef, statsRef, introRef]);

  // the pellet count jumps to full brightness on every change, then fades back over 0.6 s
  const lastFood = useRef(0);
  const onStats = useCallback((st: KoiPondStats) => {
    setStats(st);
    if (st.food !== lastFood.current) {
      lastFood.current = st.food;
      setFlash(true);
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        raf.current = requestAnimationFrame(() => setFlash(false));
      });
    }
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // The intro sits at the foot of a one-screen page. When the site's floating controls (music, the launcher)
  // stand in the intro's column, as on phones, the intro rises just clear of them (--pond-clear on the page).
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = pageRef.current, intro = introRef.current;
    if (!page || !intro) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const right = intro.getBoundingClientRect().right;
      const bottom = page.getBoundingClientRect().bottom;
      let clear = 0;
      for (const el of document.querySelectorAll<HTMLElement>("body > [data-plugin]")) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height && r.left < right && r.top < bottom) clear = Math.max(clear, bottom - r.top);
      }
      page.style.setProperty("--pond-clear", `${Math.round(clear)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const sizes = new ResizeObserver(schedule);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(page);
      document.querySelectorAll<HTMLElement>("body > [data-plugin]").forEach((el) => sizes.observe(el));
      schedule();
    };
    // plugins mount into <body> after hydration and can come and go
    const mounts = new MutationObserver(watch);
    mounts.observe(document.body, { childList: true });
    window.addEventListener("resize", schedule);
    watch();
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      mounts.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div className={s.page} ref={pageRef}>
      <header className={s.header}>
        <Nav items={data.nav} current="home" labels={data.labels} navRef={navRef} />
        <div className={s.stats} ref={statsRef} aria-live="polite">
          <span>{stats.fish}</span>
          <span className={flash ? s.flash : undefined}>{stats.food}</span>
        </div>
      </header>

      <main id="main" className={s.main}>
        {/* decorative: the drop's box lets the pointer through (the koi keep clear of it); only its body takes a press */}
        <div className={s.drop} aria-hidden="true">
          <InkBot react={poke} />
          <div
            className={s.dropBody}
            ref={dropBodyRef}
            onPointerDown={(e) => {
              if (e.button === 0) setPoke((n) => n + 1);
            }}
          />
        </div>
        <section className={s.intro} ref={introRef}>
          {data.motto.length > 0 && (
            <p className={s.motto}>
              {data.motto.map((line, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
              <span className={s.caret} aria-hidden="true" />
            </p>
          )}
          <div className={`${s.bio} ${data.motto.length ? "" : s.first}`} ref={bioRef}>
            <h1 className={s.greeting}>{data.greeting}</h1>
            {data.lines.map((line, i) => (
              <p key={i}>
                {line.map((part, j) => (
                  <Linked key={j} part={part} />
                ))}
              </p>
            ))}
          </div>
          {data.social.length > 0 && (
            <p className={s.social} ref={socialRef}>
              {data.social.map((l, i) => (
                <Fragment key={l.href}>
                  {i > 0 && <span className={s.sep}> / </span>}
                  <a
                    className={s.link}
                    href={l.href}
                    {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    {l.text}
                  </a>
                </Fragment>
              ))}
            </p>
          )}
        </section>
      </main>

      {/* after the text in the DOM so Tab reaches the nav and links first; it lies underneath them */}
      <KoiPond
        className={s.pond}
        theme={theme}
        fishCount={FISH}
        label={data.labels.pond}
        onStats={onStats}
        avoid={avoid}
        dim={dim}
      />
    </div>
  );
}
