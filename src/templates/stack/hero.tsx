"use client";

// The avatar with the other portraits tucked behind it. Hovering fans the pile out; clicking docks the
// avatar beside the name and the photos fly out of the pile into a row; a photo in the row grows
// when hovered and pushes its neighbours aside. Offsets as measured from the recording.

import { useState, type CSSProperties } from "react";
import s from "./stack.module.css";

// pile → fan (hover) → row (open): the photos are the same elements in all three states.
// Offsets relative to the 60 px avatar (photos are 70 px boxes).
const FAN = [
  { x: -34, y: -6, r: -12, z: 2 },
  { x: 35, y: -6, r: 12, z: 3 },
  { x: 30, y: -40, r: 16, z: 1 },
  { x: -26, y: -36, r: -9, z: 0 },
];
const ROW_TOP = 62; // the row's top edge, from the top of the header
const ROW_GAP = 7;
const PHOTO = 70;
const GROWN = 94; // a hovered photo in the row
const TILT = [-3, 3, -2.5, 3];

function rowLayout(n: number, hovered: number) {
  const widths = Array.from({ length: n }, (_, i) => (i === hovered ? GROWN : PHOTO));
  const total = widths.reduce((a, b) => a + b, 0) + ROW_GAP * (n - 1);
  const rest = n * PHOTO + ROW_GAP * (n - 1);
  // the row grows evenly on both sides around its resting centre
  let x = (rest - total) / 2;
  return widths.map((w) => {
    const cx = x + w / 2;
    x += w + ROW_GAP;
    return { cx, scale: w / PHOTO };
  });
}

export function Hero({
  name,
  role,
  avatar,
  photos,
  showLabel,
  hideLabel,
}: {
  name: string;
  role: string;
  avatar: string | null;
  photos: string[];
  showLabel: string;
  hideLabel: string;
}) {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(-1);
  const row = rowLayout(photos.length, pick);

  const photoStyle = (i: number): CSSProperties => {
    let t: string;
    if (open) {
      const { cx, scale } = row[i];
      t = `translate(${cx - PHOTO / 2}px, ${ROW_TOP}px) rotate(${pick === i ? TILT[i] : 0}deg) scale(${scale})`;
    } else if (hover) {
      const f = FAN[i];
      t = `translate(${f.x - 5}px, ${f.y - 5}px) rotate(${f.r}deg) scale(${(0.97 * 60) / PHOTO})`;
    } else {
      t = `translate(-5px, -5px) rotate(${i * 22 + 11}deg) scale(${(1.06 * 60) / PHOTO})`;
    }
    return { transform: t, zIndex: open ? (pick === i ? 5 : 1) : FAN[i].z, ["--i" as string]: i };
  };

  const face = avatar ? <img className={s.face} src={avatar} alt="" /> : null;
  return (
    <header id="about" className={s.hero} data-open={open} data-hover={hover && !open} data-avatar={!!avatar}>
      {avatar && photos.length ? (
        <button
          type="button"
          className={s.avatar}
          onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
          onPointerLeave={() => setHover(false)}
          onClick={() => {
            setOpen((o) => !o);
            setPick(-1);
          }}
          aria-expanded={open}
          aria-controls="stack-photos"
          aria-label={`${open ? hideLabel : showLabel} ${name}`}
        >
          {face}
        </button>
      ) : (
        avatar && <span className={s.avatar}>{face}</span>
      )}
      <div className={s.idText}>
        <h1>{name}</h1>
        {role && <p>{role}</p>}
      </div>
      {avatar && photos.length > 0 && (
        <div id="stack-photos" className={s.photosRow} onPointerLeave={() => setPick(-1)}>
          {photos.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              className={s.mePhoto}
              style={photoStyle(i)}
              onPointerEnter={() => open && setPick(i)}
            />
          ))}
        </div>
      )}
    </header>
  );
}
