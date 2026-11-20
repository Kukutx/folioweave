"use client";

// CardStack — a stack of cards you look through.
//
//   <CardStack />                                   payment cards (content.ts), shuffle layout
//   <CardStack layout="fan" cards={clips} onHover={(i) => ...} />
//
// layout "stack" (the recorded card shuffle): frosted-glass cards, the front one on top and the others
//   lying behind it, each at its own tilt. Click the stack (or press Enter / Space / → / ←) and the front
//   card swings out to the side, shrinking away and going soft, slips behind the stack and settles at
//   the back, while the next card rises to the front. Clicks alternate right and left; drag the front
//   card sideways and let go to throw it that way. Nothing moves until it is clicked, dragged or keyed.
// layout "fan": the same cards spread out as one 3D fan seen in perspective; hovering (or focusing) a
//   card slides it up-left, out of the fan. Frame-atlas cards loop like a muted video.
//
// Self-contained (React only). Sizes from its container: the stack's design area (the swing included)
// scales down when the container is narrower. Colours: --paper (card glass), --ink, --muted, --accent
// (verified badge); font: --cs-font.
// Motion runs on the compositor (Web Animations on transform and opacity only); the soft focus of a
// card swinging away is a cross-fade to a pre-blurred copy of its face, never an animated filter.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from "react";
import {
  CARDS,
  RESTS,
  type FramesCard,
  type PaymentCard,
  type StackCard,
} from "./content";
import s from "./card-stack.module.css";

export type {
  CardRest,
  FramesCard,
  ImageCard,
  PaymentCard,
  StackCard,
} from "./content";

export type CardStackProps = {
  cards?: StackCard[];
  layout?: "stack" | "fan";
  /** Stack layout: shuffle by itself every this many ms (off by default). */
  autoplay?: number;
  /** Called with the index (into `cards`) of the new front card. */
  onChange?: (index: number) => void;
  /** Called with the index (into `cards`) of the card under the pointer / focus. */
  onHover?: (index: number) => void;
  /** Accessible name of the stack. */
  label?: string;
  className?: string;
  style?: CSSProperties;
};

// ---- stack layout: measured on the card-shuffle recording (CSS px, ms, 60 fps samples) ----
const CARD = { w: 333, h: 143 };
/** Design area: the whole swing fits in it. The stack's centre sits at (cx, cy). */
const AREA = { w: 620, h: 262, cx: 310, cy: 126 };
/** The frosted glass of the front card: what lies behind it, drawn once and blurred, with this margin. */
const PAD = 80;
/** Behind the front card: extra drop and scale per depth (1 = right behind the front card). */
const DEPTH_Y = [0, 4, 8.5, 12.2];
const DEPTH_S = [1, 0.973, 0.96, 0.94];
/** Opacity of a card's face content by depth: behind the front card it shows only through the glass. */
const DEPTH_INK = [1, 0.57, 0.5, 0.44];
const FRAME = 1000 / 60;
// the front card swinging out: eased share of the way out, one value per 60 fps frame
const OUT = [
  0, 0.0053, 0.0193, 0.048, 0.094, 0.164, 0.262, 0.382, 0.544, 0.702, 0.86, 1,
];
// …and on its way back in behind the stack (from the turn), one value per frame
const BACK = [
  0, 0.03, 0.095, 0.24, 0.42, 0.57, 0.7, 0.81, 0.9, 0.95, 0.98, 0.995, 1,
];
const BACK_ROT = [
  0, 0.1, 0.24, 0.42, 0.6, 0.73, 0.84, 0.91, 0.96, 0.985, 0.995, 1, 1,
];
/** Turn of the swing: the card is this far out (px), this small, and passes behind the stack. */
const SWING = {
  x: 225,
  s: 0.482,
  y: 13.95,
  yTilt: 0.207,
  r: 14.1,
  rTilt: 0.345,
};
const T_TURN = (OUT.length - 1) * FRAME;
const T_LEAVE = T_TURN + (BACK.length - 1) * FRAME;
/** The cards behind move up one place: start, duration, CSS ease; the tilt overshoots a little. */
const RISE = {
  at: 125,
  ms: 233,
  ease: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  over: 0.06,
  settle: 420,
};
/** How long a card's frosted glass takes to clear or to frost over (ms). */
const FROST_FADE = 100;
const DRAG_THROW = 60;
const CLICK_SLOP = 5;

type Pose = { x: number; y: number; r: number; s: number };
const css = (p: Pose) =>
  `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) rotate(${p.r.toFixed(3)}deg) scale(${p.s.toFixed(4)})`;
const sample = (tab: number[], i: number) => {
  if (i <= 0) return tab[0];
  if (i >= tab.length - 1) return tab[tab.length - 1];
  const k = Math.floor(i);
  return tab[k] + (tab[k + 1] - tab[k]) * (i - k);
};
/** CSS cubic-bezier(x1, y1, x2, y2) evaluated at time share u. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const f = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (u: number) => {
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (f(x1, x2, m) < u) lo = m;
      else hi = m;
    }
    return f(y1, y2, (lo + hi) / 2);
  };
}
const ease = bezier(0.25, 0.1, 0.25, 1);

// ---- fan layout (measured from the portfolio recording): one homography per card, origin 0 0 ----
const FAN = { w: 580, h: 419, cw: 360, ch: 278, left: 95, span: 770 }; // left / span: the fan's real extent
const FAN_SLOTS = [
  "matrix3d(0.672662, -0.226254, 0, 0.000161347, 0.0389023, 0.648853, 0, 0.000136784, 0, 0, 1, 0, -88.6978, 86.3702, 0, 1)",
  "matrix3d(0.68363, -0.229943, 0, 0.000163978, 0.0395366, 0.659432, 0, 0.000139015, 0, 0, 1, 0, 6.97288, 105.854, 0, 1)",
  "matrix3d(0.694465, -0.233588, 0, 0.000166577, 0.0401633, 0.669885, 0, 0.000141219, 0, 0, 1, 0, 105.306, 126.98, 0, 1)",
  "matrix3d(0.704505, -0.236965, 0, 0.000168985, 0.0407439, 0.679569, 0, 0.00014326, 0, 0, 1, 0, 172.29, 161.59, 0, 1)",
  "matrix3d(0.718918, -0.241813, 0, 0.000172442, 0.0415774, 0.693472, 0, 0.000146191, 0, 0, 1, 0, 240.667, 197.34, 0, 1)",
  "matrix3d(0.731588, -0.246074, 0, 0.000175481, 0.0423102, 0.705693, 0, 0.000148767, 0, 0, 1, 0, 343.849, 219.3, 0, 1)",
  "matrix3d(0.748714, -0.251835, 0, 0.000179589, 0.0433003, 0.722213, 0, 0.000152249, 0, 0, 1, 0, 448.915, 242.111, 0, 1)",
];

const AVATAR_COLORS = ["#f5b8a8", "#b8d4f5", "#c9e8b5", "#e5c6f2"];

function useScale(designW: number, span = designW) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // at full size the design may bleed past its box (the fan does); narrower, the whole extent fits
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setK(w >= designW ? 1 : Math.min(1, w / span));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [designW, span]);
  return [ref, k] as const;
}

function Badge() {
  return (
    <svg className={s.badge} viewBox="0 0 22 22" aria-label="verified">
      <path
        fill="currentColor"
        d="M20.4 11c0-1.3-.8-2.5-2-3 .4-1.2.1-2.6-.8-3.5-.9-.9-2.3-1.2-3.5-.8-.5-1.2-1.7-2-3-2s-2.5.8-3 2c-1.2-.4-2.6-.1-3.5.8-.9.9-1.2 2.3-.8 3.5-1.2.5-2 1.7-2 3s.8 2.5 2 3c-.4 1.2-.1 2.6.8 3.5.9.9 2.3 1.2 3.5.8.5 1.2 1.7 2 3 2s2.5-.8 3-2c1.2.4 2.6.1 3.5-.8.9-.9 1.2-2.3.8-3.5 1.2-.5 2-1.7 2-3z"
      />
      <path
        d="m7.4 11.2 2.4 2.4 4.8-5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Avatar({ src, name, i }: { src?: string; name: string; i: number }) {
  return src ? (
    <img
      className={s.avatar}
      src={src}
      alt=""
      draggable={false}
      decoding="async"
    />
  ) : (
    <span
      className={s.avatar}
      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Payment({ c }: { c: PaymentCard }) {
  const v = c.verified ?? true;
  return (
    <>
      <div className={s.amount}>{c.amount}</div>
      <div className={s.avatars}>
        <Avatar src={c.avatars?.[0]} name={c.from} i={0} />
        <Avatar src={c.avatars?.[1]} name={c.to} i={1} />
      </div>
      <div className={s.line}>
        <b>{c.from}</b>
        {v && <Badge />}
        <span className={s.paid}>paid</span>
        <b>{c.to}</b>
        {v && <Badge />}
      </div>
      {c.note && <div className={s.note}>“{c.note}”</div>}
      {c.time && <div className={s.time}>{c.time}</div>}
    </>
  );
}

const spoken = (c: StackCard) =>
  c.kind === "frames" || c.kind === "image"
    ? (c.label ?? "")
    : `${c.amount}, ${c.from} paid ${c.to}${c.note ? `, ${c.note}` : ""}${c.time ? `, ${c.time}` : ""}`;

/** Plays every frame-atlas card on its canvas while the stack is on screen and the page is visible. */
function useFrames(
  cards: StackCard[],
  canvases: React.MutableRefObject<(HTMLCanvasElement | null)[]>,
  root: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const clips = cards
      .map((c, k) => ({ c, k }))
      .filter((x): x is { c: FramesCard; k: number } => x.c.kind === "frames");
    if (!clips.length) return;
    const atlases = clips.map(({ c }) =>
      c.atlases.map((src) => {
        const im = new Image();
        im.decoding = "async";
        im.src = src;
        return im;
      }),
    );
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = false;
    let raf = 0;
    const t0 = performance.now();
    const last = clips.map(() => -1);
    const draw = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      clips.forEach(({ c, k }, i) => {
        const f = still
          ? 0
          : Math.floor(((now - t0) / 1000) * c.fps) % c.frames;
        if (f === last[i]) return;
        const cv = canvases.current[k];
        const im = atlases[i][Math.floor(f / c.perAtlas)];
        const ctx = cv?.getContext("2d");
        if (!ctx || !im?.complete || !im.naturalWidth) return;
        const j = f % c.perAtlas;
        const [tw, th] = c.tile;
        ctx.drawImage(
          im,
          (j % c.cols) * tw,
          Math.floor(j / c.cols) * th,
          tw,
          th,
          0,
          0,
          cv!.width,
          cv!.height,
        );
        last[i] = f;
      });
      raf = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (visible && !document.hidden && !raf)
        raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        wake();
      },
      { rootMargin: "200px" },
    );
    if (root.current) io.observe(root.current);
    document.addEventListener("visibilitychange", wake);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
    };
  }, [cards, canvases, root]);
}

function Face({
  c,
  k,
  onCanvas,
}: {
  c: StackCard;
  k: number;
  onCanvas?: (k: number, el: HTMLCanvasElement | null) => void;
}) {
  if (c.kind === "frames")
    return onCanvas ? (
      <canvas
        className={s.media}
        width={c.tile[0]}
        height={c.tile[1]}
        ref={(el) => onCanvas(k, el)}
      />
    ) : null;
  if (c.kind === "image")
    return (
      <img
        className={s.media}
        src={c.src}
        alt={c.label ?? ""}
        draggable={false}
        decoding="async"
      />
    );
  return <Payment c={c} />;
}

/**
 * The front card's frosted glass. Behind the front card lie the surface, its light and the other cards;
 * this draws that scene once, blurred, inside the card (as backdrop-filter would, but static, so moving
 * the card costs nothing). Card `id` is in front when the others follow it in order.
 */
function Frost({
  cards,
  id,
  on,
}: {
  cards: StackCard[];
  id: number;
  on: boolean;
}) {
  const n = cards.length;
  const behind: { oid: number; d: number }[] = [];
  for (let d = n - 1; d >= 1; d--) behind.push({ oid: (id + d) % n, d });
  return (
    <div
      className={s.lens}
      data-frost=""
      aria-hidden="true"
      style={{ opacity: on ? 1 : 0 }}
    >
      <div className={s.frost}>
        <div
          className={s.halo}
          style={{ left: PAD + CARD.w / 2, top: PAD + CARD.h / 2 }}
        />
        {behind.map(({ oid, d }) => (
          <div
            key={oid}
            className={s.ghost}
            style={{
              left: PAD,
              top: PAD,
              width: CARD.w,
              height: CARD.h,
              transform: css(poseAt(cards, oid, d)),
            }}
          >
            <div className={s.ink}>
              <Face c={cards[oid]} k={oid} />
            </div>
          </div>
        ))}
      </div>
      <div className={s.veil} />
    </div>
  );
}

/** Where card `id` lies at depth `d` (0 = front). */
function poseAt(cards: StackCard[], id: number, d: number): Pose {
  if (d === 0) return { x: 0, y: 0, r: 0, s: 1 };
  const rest = cards[id].rest ?? RESTS[id % RESTS.length];
  const k = Math.min(d, DEPTH_Y.length - 1);
  return { x: rest.x, y: rest.y + DEPTH_Y[k], r: rest.r, s: DEPTH_S[k] };
}
const inkAt = (d: number) => DEPTH_INK[Math.min(d, DEPTH_INK.length - 1)];

export function CardStack({
  cards = CARDS,
  layout = "stack",
  autoplay,
  onChange,
  onHover,
  label,
  className,
  style,
}: CardStackProps) {
  const fan = layout === "fan";
  const [rootRef, k] = useScale(fan ? FAN.w : AREA.w, fan ? FAN.span : AREA.w);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  useFrames(cards, canvases, rootRef);
  const onCanvas = useCallback((i: number, el: HTMLCanvasElement | null) => {
    canvases.current[i] = el;
  }, []);

  // ---- stack layout state: order[0] is the front card ----
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const orderRef = useRef(order);
  useLayoutEffect(() => {
    orderRef.current = order;
  });
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const nextDir = useRef(1);
  const busyUntil = useRef(0);
  const queued = useRef<{ dir?: number } | null>(null);
  const queueT = useRef(0);
  const shuffleRef = useRef<(dir?: number) => void>(() => {});
  const drag = useRef<{
    x: number;
    y: number;
    dx: number;
    dy: number;
    id: number;
    moved: boolean;
  } | null>(null);
  const kRef = useRef(k);
  useLayoutEffect(() => {
    kRef.current = k;
  });
  const [hover, setHover] = useState(-1);
  if (order.length !== cards.length) setOrder(cards.map((_, i) => i));

  const shuffle = useCallback(
    (dir?: number, from?: { dx: number; dy: number }) => {
      if (fan) return;
      const ord = orderRef.current;
      const n = ord.length;
      if (n < 2) return;
      const now = performance.now();
      if (now < busyUntil.current) {
        // one click is remembered while a card is still on its way, and runs once it has settled
        queued.current = { dir };
        window.clearTimeout(queueT.current);
        queueT.current = window.setTimeout(() => {
          queueT.current = 0;
          const q = queued.current;
          queued.current = null;
          if (q) shuffleRef.current(q.dir);
        }, busyUntil.current - now + 5);
        return;
      }
      const d = dir ?? nextDir.current;
      nextDir.current = -d;
      const next = [...ord.slice(1), ord[0]];
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!reduced) {
        busyUntil.current = now + T_LEAVE;
        // the leaving card: out to the side, then back in behind the stack
        const id = ord[0];
        const el = els.current[id];
        const B = poseAt(cards, id, n - 1);
        if (el) {
          const off = from ?? { dx: 0, dy: 0 };
          const O: Pose = {
            x: d * SWING.x,
            y: SWING.y + SWING.yTilt * B.r,
            r: d * SWING.r + SWING.rTilt * B.r,
            s: SWING.s,
          };
          const frames: Keyframe[] = [];
          const steps = Math.round(T_LEAVE / FRAME);
          for (let i = 0; i <= steps; i++) {
            const t = i * FRAME;
            let p: Pose;
            if (t <= T_TURN) {
              const e = sample(OUT, t / FRAME);
              p = {
                x: O.x * e + off.dx * (1 - e),
                y: O.y * e + off.dy * (1 - e),
                r: O.r * e,
                s: 1 + (O.s - 1) * e,
              };
            } else {
              const j = (t - T_TURN) / FRAME;
              const q = sample(BACK, j),
                qr = sample(BACK_ROT, j);
              p = {
                x: O.x + (B.x - O.x) * q,
                y: O.y + (B.y - O.y) * q,
                r: O.r + (B.r - O.r) * qr,
                s: O.s + (B.s - O.s) * q,
              };
            }
            // over the stack on its way out; it passes behind the stack at the turn
            frames.push({
              transform: css(p),
              zIndex: t < T_TURN ? 100 : 0,
              offset: i / steps,
            });
          }
          el.animate(frames, {
            duration: T_LEAVE,
            easing: "linear",
            fill: "backwards",
          });
          const ink = el.querySelector<HTMLElement>("[data-ink]");
          const soft = el.querySelector<HTMLElement>("[data-soft]");
          const ink1 = inkAt(n - 1);
          ink?.animate(
            [
              { opacity: 1, offset: 0 },
              { opacity: 1, offset: 0.3 },
              { opacity: 0, offset: T_TURN / T_LEAVE },
              { opacity: 0, offset: 0.78 },
              { opacity: ink1, offset: 1 },
            ],
            { duration: T_LEAVE, fill: "backwards" },
          );
          soft?.animate(
            [
              { opacity: 0, offset: 0 },
              { opacity: 0, offset: 0.3 },
              { opacity: 1, offset: T_TURN / T_LEAVE },
              { opacity: 1, offset: 0.62 },
              { opacity: 0, offset: 0.92 },
            ],
            { duration: T_LEAVE, fill: "backwards" },
          );
          // its glass stays frosted while it is over the stack and clears once it has gone behind
          el.querySelector<HTMLElement>("[data-frost]")?.animate(
            [
              { opacity: 1, offset: 0 },
              { opacity: 1, offset: T_TURN / T_LEAVE },
              { opacity: 0, offset: (T_TURN + FROST_FADE) / T_LEAVE },
            ],
            { duration: T_LEAVE, fill: "backwards" },
          );
        }
        // the others move up one place
        ord.slice(1).forEach((cid, i) => {
          const e2 = els.current[cid];
          if (!e2) return;
          const A = poseAt(cards, cid, i + 1);
          const Bp = poseAt(cards, cid, i);
          const frames: Keyframe[] = [];
          const total = RISE.at + RISE.ms + RISE.settle;
          const steps = Math.round(total / FRAME);
          for (let j = 0; j <= steps; j++) {
            const t = j * FRAME;
            const u = Math.max(0, Math.min(1, (t - RISE.at) / RISE.ms));
            const q = ease(u);
            // the tilt runs slightly past its new angle and eases back
            const late = Math.max(
              0,
              (t - RISE.at - RISE.ms * 0.8) / (RISE.ms * 0.2 + RISE.settle),
            );
            const over =
              A.r !== Bp.r
                ? RISE.over *
                  Math.sin(Math.PI * Math.min(1, late * 1.6)) *
                  Math.exp(-2.2 * late)
                : 0;
            const r =
              A.r +
              (Bp.r - A.r) * Math.min(1, ease(Math.min(1, u * 1.08))) -
              (A.r - Bp.r) * -over;
            frames.push({
              transform: css({
                x: A.x + (Bp.x - A.x) * q,
                y: A.y + (Bp.y - A.y) * q,
                r,
                s: A.s + (Bp.s - A.s) * q,
              }),
              offset: j / steps,
            });
          }
          e2.animate(frames, {
            duration: total,
            easing: "linear",
            fill: "backwards",
          });
          const ink = e2.querySelector<HTMLElement>("[data-ink]");
          ink?.animate([{ opacity: inkAt(i + 1) }, { opacity: inkAt(i) }], {
            delay: RISE.at,
            duration: RISE.ms,
            easing: RISE.ease,
            fill: "backwards",
          });
          // the next card frosts over as soon as the front card starts to move away
          if (i === 0)
            e2.querySelector<HTMLElement>("[data-frost]")?.animate(
              [{ opacity: 0 }, { opacity: 1 }],
              {
                duration: FROST_FADE,
                fill: "backwards",
              },
            );
        });
      }
      setOrder(next);
      onChange?.(next[0]);
    },
    [fan, cards, onChange],
  );

  // a click made while a card was still moving runs once it has settled (no polling)
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);
  useEffect(() => () => window.clearTimeout(queueT.current), []);

  useEffect(() => {
    if (fan || !autoplay || hover >= 0) return;
    // shuffles only while the stack is on screen
    let seen = true;
    const io = new IntersectionObserver(([e]) => (seen = e.isIntersecting));
    if (rootRef.current) io.observe(rootRef.current);
    const t = setInterval(
      () => seen && !drag.current && !document.hidden && shuffle(),
      autoplay,
    );
    return () => {
      clearInterval(t);
      io.disconnect();
    };
  }, [fan, autoplay, hover, shuffle, rootRef]);

  const enter = (i: number) => {
    setHover(i);
    onHover?.(i);
  };
  const leave = (i: number) => setHover((h) => (h === i ? -1 : h));

  if (fan) {
    return (
      <div
        ref={rootRef}
        className={`${s.root} ${className ?? ""}`}
        style={{ height: FAN.h * k, ...style }}
        role="group"
        aria-label={label}
      >
        <div
          className={s.stage}
          style={{
            width: FAN.w,
            height: FAN.h,
            transform: `translateX(${k < 1 ? FAN.left * k : 0}px) scale(${k})`,
          }}
        >
          {cards.slice(0, FAN_SLOTS.length).map((c, i) => (
            <div
              key={i}
              className={s.slot}
              data-hover={hover === i}
              style={{ zIndex: i }}
              tabIndex={0}
              aria-label={"label" in c ? c.label : undefined}
              onPointerEnter={() => enter(i)}
              onPointerLeave={() => leave(i)}
              onFocus={() => enter(i)}
              onBlur={() => leave(i)}
            >
              <div
                className={s.fanCard}
                style={{
                  width: FAN.cw,
                  height: FAN.ch,
                  transform: FAN_SLOTS[i],
                }}
              >
                <Face c={c} k={i} onCanvas={onCanvas} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- pointer: click shuffles, a sideways drag of the front card throws it that way ----
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const id = orderRef.current[0];
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      dx: 0,
      dy: 0,
      id,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g || performance.now() < busyUntil.current) return;
    g.dx = (e.clientX - g.x) / kRef.current;
    g.dy = ((e.clientY - g.y) / kRef.current) * 0.25;
    if (!g.moved && Math.abs(g.dx) > CLICK_SLOP) {
      g.moved = true;
      els.current[g.id]?.setAttribute("data-dragging", "");
    }
    if (g.moved) {
      const el = els.current[g.id];
      if (el)
        el.style.transform = css({ x: g.dx, y: g.dy, r: g.dx * 0.03, s: 1 });
    }
  };
  const onUp = () => {
    const g = drag.current;
    if (!g) return;
    drag.current = null;
    const el = els.current[g.id];
    el?.removeAttribute("data-dragging");
    if (!g.moved) {
      shuffle();
      return;
    }
    if (Math.abs(g.dx) > DRAG_THROW && performance.now() >= busyUntil.current) {
      if (el) el.style.transform = css(poseAt(cards, g.id, cards.length - 1));
      shuffle(Math.sign(g.dx), { dx: g.dx, dy: g.dy });
    } else if (el) {
      // a short drag springs back
      el.animate(
        [
          { transform: el.style.transform },
          { transform: css(poseAt(cards, g.id, 0)) },
        ],
        {
          duration: 320,
          easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        },
      );
      el.style.transform = css(poseAt(cards, g.id, 0));
    }
  };

  const front = cards[order[0]];
  return (
    <div
      ref={rootRef}
      className={`${s.root} ${s.stackRoot} ${className ?? ""}`}
      style={{ height: AREA.h * k, ...style }}
      tabIndex={0}
      role="group"
      aria-roledescription="card stack"
      aria-label={label ?? `${order[0] + 1} / ${cards.length}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") shuffle(1);
        else if (e.key === "ArrowLeft") shuffle(-1);
        else if (e.key === " " || e.key === "Enter") shuffle();
        else return;
        e.preventDefault();
      }}
    >
      <div
        className={s.stage}
        style={{
          width: AREA.w,
          height: AREA.h,
          transform: `translateX(${(-AREA.w / 2) * k}px) scale(${k})`,
        }}
      >
        <div
          className={s.halo}
          style={{ left: AREA.cx, top: AREA.cy }}
          aria-hidden="true"
        />
        {cards.map((c, id) => {
          const d = order.indexOf(id);
          return (
            <div
              key={id}
              ref={(el) => {
                els.current[id] = el;
              }}
              className={s.card}
              data-front={d === 0 || undefined}
              aria-hidden={d !== 0}
              style={{
                left: AREA.cx - CARD.w / 2,
                top: AREA.cy - CARD.h / 2,
                width: CARD.w,
                height: CARD.h,
                transform: css(poseAt(cards, id, d)),
                zIndex: cards.length - d,
              }}
              onPointerDown={d === 0 ? onDown : undefined}
              onPointerMove={d === 0 ? onMove : undefined}
              onPointerUp={d === 0 ? onUp : undefined}
              onPointerCancel={d === 0 ? onUp : undefined}
            >
              <div className={s.glass}>
                <div className={s.fill} />
                <Frost cards={cards} id={id} on={d === 0} />
              </div>
              <div className={s.ink} data-ink="" style={{ opacity: inkAt(d) }}>
                <Face c={c} k={id} onCanvas={onCanvas} />
              </div>
              {c.kind !== "frames" && (
                <div className={s.soft} data-soft="" aria-hidden="true">
                  <div className={s.blurred}>
                    <Face c={c} k={id} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <span className={s.srOnly} aria-live="polite">
        {spoken(front)}
      </span>
    </div>
  );
}

export default CardStack;
