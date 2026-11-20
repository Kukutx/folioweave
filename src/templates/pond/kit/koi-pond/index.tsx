"use client";

import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { koiPondContent, type KoiPalette } from "./content";
import { Pond, type PondRect, type PondStats } from "./engine";
import s from "./koi-pond.module.css";

export type { KoiPalette } from "./content";
export type { PondStats as KoiPondStats } from "./engine";

type Refs = RefObject<HTMLElement | null>[];

export type KoiPondProps = {
  /** how many koi swim in the pond */
  fishCount?: number;
  /** character cell in CSS px: one number for square cells, or [width, height] */
  cell?: number | [number, number];
  /** override koi colours (otherwise --koi-<name> CSS variables or the defaults for the --paper brightness) */
  palette?: Partial<KoiPalette>;
  /** glyphs printed on the scales */
  glyphs?: string;
  /** pellets per drop, [min, max] */
  pellets?: [number, number];
  /** accessible name of the pond */
  label?: string;
  /** any value that changes with the host theme; colours are re-read from --paper / --ink at once and eased over 0.3 s */
  theme?: string;
  /** called when the number of fish or pellets in the water changes */
  onStats?: (stats: PondStats) => void;
  /** elements laid over the pond (a block of text) that the koi steer around */
  avoid?: Refs;
  /** elements whose text the pond passes under: it is drawn only faintly beneath their line boxes */
  dim?: Refs;
  className?: string;
  style?: CSSProperties;
};

/**
 * A koi pond drawn on a character grid. It fills its container; colours follow the host's
 * --paper / --ink custom properties. Click (or Enter / Space) drops food, the koi chase and eat it.
 */
export function KoiPond({
  fishCount = koiPondContent.fishCount,
  cell = koiPondContent.cell,
  palette,
  glyphs = koiPondContent.glyphs,
  pellets = koiPondContent.pellets,
  label = koiPondContent.label,
  theme,
  onStats,
  avoid,
  dim,
  className,
  style,
}: KoiPondProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pondRef = useRef<Pond | null>(null);
  const statsRef = useRef(onStats);
  const avoidRef = useRef(avoid);
  const dimRef = useRef(dim);
  const init = useRef({ cell, fishCount, glyphs, pellets, palette });

  useEffect(() => {
    statsRef.current = onStats;
  }, [onStats]);
  useEffect(() => {
    avoidRef.current = avoid;
    dimRef.current = dim;
  }, [avoid, dim]);

  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current;
    if (!root || !canvas) return;
    const o = init.current;
    // whole boxes (lines = false) or the line boxes of the text inside (lines = true)
    const range = document.createRange();
    const rects = (refs: Refs | undefined, lines: boolean) => {
      const box = root.getBoundingClientRect();
      const out: PondRect[] = [];
      for (const r of refs || []) {
        const el = r.current;
        if (!el) continue;
        let list: ArrayLike<DOMRect> = [el.getBoundingClientRect()];
        if (lines) {
          range.selectNodeContents(el);
          list = range.getClientRects();
        }
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          if (b.width > 0.5 && b.height > 0.5) out.push({ x: b.left - box.left, y: b.top - box.top, w: b.width, h: b.height });
        }
      }
      return out;
    };
    const pond = new Pond(canvas, root, {
      cell: o.cell,
      fishCount: o.fishCount,
      glyphs: o.glyphs,
      pellets: o.pellets,
      palette: o.palette,
      onStats: (st) => statsRef.current?.(st),
      getAvoid: () => rects(avoidRef.current, false),
      getDim: () => rects(dimRef.current, true),
    });
    pondRef.current = pond;
    return () => {
      pond.destroy();
      pondRef.current = null;
    };
  }, []);

  useEffect(() => {
    pondRef.current?.setFishCount(fishCount);
  }, [fishCount]);

  const paletteKey = palette ? JSON.stringify(palette) : "";
  useEffect(() => {
    pondRef.current?.setPalette(paletteKey ? (JSON.parse(paletteKey) as Partial<KoiPalette>) : undefined);
  }, [paletteKey]);

  useEffect(() => {
    pondRef.current?.setGlyphs(glyphs);
  }, [glyphs]);

  const [pMin, pMax] = pellets;
  useEffect(() => {
    pondRef.current?.setPellets([pMin, pMax]);
  }, [pMin, pMax]);

  useEffect(() => {
    pondRef.current?.refreshColors();
  }, [theme]);

  const local = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div
      ref={rootRef}
      className={className ? `${s.root} ${className}` : s.root}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const [x, y] = local(e);
        pondRef.current?.move(x, y);
        pondRef.current?.drop(x, y);
      }}
      onPointerMove={(e) => {
        const [x, y] = local(e);
        pondRef.current?.move(x, y);
      }}
      onPointerLeave={() => pondRef.current?.leave()}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pondRef.current?.dropSomewhere();
        }
      }}
    >
      <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" />
    </div>
  );
}

export default KoiPond;
