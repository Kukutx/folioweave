"use client";

// "Stuff I do" and the fan of work under it: the projects' pictures laid out as one 3D arrangement
// seen in perspective (measured from the recording and baked into one homography per card).
// Hovering (or focusing) a card slides it up-left out of the fan and lights its project's name,
// which stays lit until another card is hovered.

import { useEffect, useState } from "react";
import type { FanCard } from "./data";
import s from "./stack.module.css";

// stack-relative px, transform-origin 0 0, back card first
const MATRICES = [
  "matrix3d(0.672662, -0.226254, 0, 0.000161347, 0.0389023, 0.648853, 0, 0.000136784, 0, 0, 1, 0, -88.6978, 86.3702, 0, 1)",
  "matrix3d(0.68363, -0.229943, 0, 0.000163978, 0.0395366, 0.659432, 0, 0.000139015, 0, 0, 1, 0, 6.97288, 105.854, 0, 1)",
  "matrix3d(0.694465, -0.233588, 0, 0.000166577, 0.0401633, 0.669885, 0, 0.000141219, 0, 0, 1, 0, 105.306, 126.98, 0, 1)",
  "matrix3d(0.704505, -0.236965, 0, 0.000168985, 0.0407439, 0.679569, 0, 0.00014326, 0, 0, 1, 0, 172.29, 161.59, 0, 1)",
  "matrix3d(0.718918, -0.241813, 0, 0.000172442, 0.0415774, 0.693472, 0, 0.000146191, 0, 0, 1, 0, 240.667, 197.34, 0, 1)",
  "matrix3d(0.731588, -0.246074, 0, 0.000175481, 0.0423102, 0.705693, 0, 0.000148767, 0, 0, 1, 0, 343.849, 219.3, 0, 1)",
  "matrix3d(0.748714, -0.251835, 0, 0.000179589, 0.0433003, 0.722213, 0, 0.000152249, 0, 0, 1, 0, 448.915, 242.111, 0, 1)",
];
const TILE: [number, number] = [360, 278];
/** the full fan's box height, as recorded (its painted extent runs 5–425) */
const FULL_H = 419;

/** Painted extent of the cards at these places (corners through each homography). */
function extent(slots: number[]) {
  const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const k of slots) {
    const m = MATRICES[k].slice(9, -1).split(",").map(Number);
    for (const [x, y] of [
      [0, 0],
      [TILE[0], 0],
      [0, TILE[1]],
      [TILE[0], TILE[1]],
    ]) {
      const w = m[3] * x + m[7] * y + m[15];
      const px = (m[0] * x + m[4] * y + m[12]) / w;
      const py = (m[1] * x + m[5] * y + m[13]) / w;
      box.left = Math.min(box.left, px);
      box.right = Math.max(box.right, px);
      box.top = Math.min(box.top, py);
      box.bottom = Math.max(box.bottom, py);
    }
  }
  return box;
}
const FULL = extent(MATRICES.map((_, k) => k));

/** Scale that fits a design `span` px wide into the viewport (never above 1), `gutter` px each side. */
export function useFit(span: number, gutter = 8) {
  const [k, setK] = useState(1);
  useEffect(() => {
    const f = () => setK(Math.min(1, (document.documentElement.clientWidth - gutter * 2) / span));
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [span, gutter]);
  return k;
}

function Fan({
  cards,
  words,
  label,
  onLight,
}: {
  cards: FanCard[];
  words: string[];
  label: string;
  onLight: (w: number) => void;
}) {
  const [hover, setHover] = useState(-1);
  // fewer cards than places take the front places; the arrangement stays centred on the column
  const slots = cards.map((_, i) => MATRICES.length - 1 - i);
  const box = extent(slots);
  const span = box.right - box.left;
  const k = useFit(span, 4);
  const dy = box.top - FULL.top;
  const h = FULL_H - (FULL.bottom - box.bottom) - dy;
  // the full fan keeps the recorded placement; a smaller one is centred where the full one was
  const shift = (FULL.left + FULL.right) / 2 - (box.left + span / 2);
  const enter = (i: number) => {
    setHover(i);
    onLight(cards[i].word);
  };
  return (
    <div className={s.fanBox} style={{ height: k < 1 ? (h + 6) * k + 8 : h }}>
      <div
        className={s.fanInner}
        style={
          k < 1
            ? { transform: `translate(${-(box.left + span / 2) * k}px, ${-dy * k}px) scale(${k})`, left: "50%" }
            : { transform: `translate(${shift}px, ${-dy}px)` }
        }
      >
        <div className={s.stack} role="list" aria-label={label}>
          {/* front card first, so keyboard order follows the words; stacking is by z-index */}
          {cards.map((card, i) => (
            <div
              key={card.src + i}
              role="listitem"
              tabIndex={0}
              aria-label={words[card.word]}
              className={s.slot}
              data-hover={hover === i}
              style={{ zIndex: slots[i] }}
              onPointerEnter={() => enter(i)}
              onPointerLeave={() => setHover((v) => (v === i ? -1 : v))}
              onFocus={() => enter(i)}
              onBlur={() => setHover((v) => (v === i ? -1 : v))}
            >
              <div
                className={s.fanCard}
                data-upright={card.upright}
                style={{ transform: MATRICES[slots[i]], width: TILE[0], height: TILE[1] }}
              >
                <img src={card.src} alt={card.alt} decoding="async" draggable={false} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Work({
  id,
  label,
  words,
  cards,
  workLabel,
}: {
  id?: string;
  label: string;
  words: string[];
  cards: FanCard[];
  workLabel: string;
}) {
  const [lit, setLit] = useState(-1);
  return (
    <>
      <section id={id} className={s.section}>
        <h2 className={s.label}>{label}</h2>
        <p className={s.stuff}>
          {words.map((w, i) => (
            <span key={i}>
              <span className={s.word} data-lit={i === lit}>
                {w}
                {i < words.length - 1 ? "," : ""}
              </span>
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      </section>
      {cards.length > 0 && <Fan cards={cards} words={words} label={workLabel} onLight={setLit} />}
    </>
  );
}
