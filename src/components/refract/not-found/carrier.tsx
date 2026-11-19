"use client";

// "404 · aircraft carrier" (547 recording), as Refract's 404 page. A carrier steams across a sea that fills the
// page; the ship, its island, the parked jets, a jet that launches off the bow catapult, flies a low pass and
// traps back aboard, the far lift going down and up and a helicopter circling are a 3D model drawn on canvases
// (deck.ts, model.ts): the sea, the ship, and a small canvas for each thing that moves. DRAG TO TURN spins the
// ship (with inertia; arrow keys too, once the scene has focus). The readout bottom right follows the 1270-frame
// flight cycle. The recorded page is the 1194 × 1140 stage; on wider or smaller windows the stage scales to fit,
// and on phones the words sit above the ship.
//
// Refract fixes the look (light or dark) for the whole site, so the original's visitor switch is gone; the
// colours come from the page's CSS custom properties (carrier.module.css).
// prefers-reduced-motion: the scene holds still (dragging still turns it). Off screen or in a hidden tab the frame
// loop stops.

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { deckLine, type CarrierWords } from "./content";
import { CARRIER_DARK, CARRIER_KEYS, CarrierScene, type CarrierColors, type Placement } from "./deck";
import { readout } from "./model";
import { mono } from "./font";
import s from "./carrier.module.css";

const RAD_PER_PX = 0.0085;
const STAGE_W = 1194;

// canvas colours come from the page's CSS custom properties (--c-<name>), the recorded ones by default
function readColors(el: HTMLElement): CarrierColors {
  const cs = getComputedStyle(el);
  const o = { ...CARRIER_DARK };
  for (const k of CARRIER_KEYS) {
    const v = cs.getPropertyValue(`--c-${k}`).trim();
    if (v) o[k] = v;
  }
  return o;
}

export function Carrier({
  look,
  words,
  home,
}: {
  look: "light" | "dark";
  words: CarrierWords;
  /** the site's name, linking home, where the original had its theme switch */
  home: string;
}) {
  const root = useRef<HTMLElement>(null);
  const seaCv = useRef<HTMLCanvasElement>(null);
  const shipCv = useRef<HTMLCanvasElement>(null);
  const stillCv = useRef<HTMLCanvasElement>(null);
  const fxBox = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState(() => deckLine(...readout(0)));
  const [dragging, setDragging] = useState(false);
  const spin = useRef({ turn: 0, vel: 0, drag: false, id: -1, lastX: 0, lastT: 0 });
  const hintId = useId();

  useEffect(() => {
    const el = root.current, fx = fxBox.current, sea = seaCv.current, ship = shipCv.current;
    if (!el || !fx || !sea || !ship) return;
    const eng = new CarrierScene({ sea, ship, still: stillCv.current ?? undefined, fx }, readColors(el));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const layout = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let place: Placement;
      const sc = scene.current?.getBoundingClientRect();
      if (r.width > 700 && sc) place = { x0: sc.left - r.left, y0: sc.top - r.top, k: sc.width / STAGE_W };
      else {
        // phones: the ship fills the width below the words
        const top = (wordsRef.current?.getBoundingClientRect().bottom ?? r.top) - r.top;
        const room = Math.max(120, r.height - top - 44);
        const k = Math.min(r.width / 860, room / 470);
        place = { x0: r.width / 2 - k * 640, y0: top + room / 2 - k * 800, k };
      }
      eng.resize(r.width, r.height, dpr, place);
    };
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    layout();
    eng.render(0, 0); // the first paint already shows the ship

    let raf = 0;
    let shown = -1;
    let last = performance.now();
    let f = 0; // frames of scene time (60 fps)
    let inView = true;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const sp = spin.current;
      if (!sp.drag && sp.vel) {
        sp.turn += sp.vel * dt;
        sp.vel *= Math.exp(-dt / 0.75);
        if (Math.abs(sp.vel) < 0.03 || still.matches) sp.vel = 0; // the last of the glide is too slow to see
      }
      eng.setTurn(sp.turn);
      if (!still.matches) f += dt * 60;
      const cyc = eng.render(f, dt);
      if (cyc !== shown) {
        const txt = deckLine(...readout(cyc));
        if (shown < 0 || txt !== deckLine(...readout(shown))) setLine(txt);
        shown = cyc;
      }
    };
    // the loop runs only while the page is on screen and the tab is visible
    const run = () => {
      const on = inView && !document.hidden;
      if (on && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!on && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      run();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", run);
    run();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", run);
      eng.destroy();
    };
  }, []);

  const onDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("a,button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const sp = spin.current;
    Object.assign(sp, { drag: true, vel: 0, id: e.pointerId, lastX: e.clientX, lastT: e.timeStamp });
    setDragging(true);
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const sp = spin.current;
    if (!sp.drag || e.pointerId !== sp.id) return;
    const dx = e.clientX - sp.lastX;
    const dt = Math.max(1, e.timeStamp - sp.lastT) / 1000;
    sp.turn -= dx * RAD_PER_PX;
    sp.vel = sp.vel * 0.6 + ((-dx * RAD_PER_PX) / dt) * 0.4;
    sp.lastX = e.clientX;
    sp.lastT = e.timeStamp;
  };
  const onUp = (e: PointerEvent<HTMLElement>) => {
    const sp = spin.current;
    if (!sp.drag || e.pointerId !== sp.id) return;
    sp.drag = false;
    if (e.timeStamp - sp.lastT > 90) sp.vel = 0; // held still before letting go
    sp.vel = Math.max(-6, Math.min(6, sp.vel));
    setDragging(false);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    spin.current.vel = 0;
    spin.current.turn += (e.key === "ArrowLeft" ? 1 : -1) * 0.12;
  };

  return (
    <main
      ref={root}
      id="main"
      className={`${s.root} ${mono.className}`}
      data-look={look}
      data-drag={dragging || undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <canvas ref={seaCv} className={s.canvas} aria-hidden="true" />
      <canvas ref={shipCv} className={s.ship} aria-hidden="true" />
      <canvas ref={stillCv} className={s.ship} aria-hidden="true" />
      <div
        ref={fxBox}
        className={s.canvas}
        role="img"
        aria-label={words.label}
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={onKey}
      />
      <header className={s.top}>
        <Link className={s.home} href="/">
          {home}
        </Link>
        <span className={s.label}>{words.label}</span>
      </header>
      <div ref={scene} className={s.scene}>
        <div ref={wordsRef} className={s.center}>
          <h1>{words.code}</h1>
          <p>{words.line}</p>
          <Link href="/" className={s.back}>
            {words.back}
          </Link>
        </div>
      </div>
      <footer className={s.bottom}>
        <span className={s.hint} id={hintId}>
          {words.hint}
        </span>
        <span className={s.stats}>{line}</span>
      </footer>
    </main>
  );
}
