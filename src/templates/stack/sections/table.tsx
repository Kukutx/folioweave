"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { ImageSet } from "../parts/image";
import { Pile, Spread } from "../parts/icons";
import type { TableLayout } from "./prints-layout";
import s from "../stack.module.css";
import t from "./prints.module.css";

type Drag = {
  id: number;
  index: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  bounds: DOMRect;
  box: DOMRect;
};

/**
 * The photographs as loose prints on the table. Any print can be picked up and moved (it
 * comes to the top of the pile); "Spread them out" lays every print square in a contact
 * sheet and "Pile them up" drops them back where they were dealt. Without JavaScript the
 * prints are laid out as the contact sheet.
 */
export function Table({
  images,
  large,
  small,
  labels,
  children,
}: {
  images: ImageSet[];
  large: TableLayout;
  small: TableLayout;
  labels: { spread: string; gather: string };
  children?: ReactNode;
}) {
  const count = images.length;
  const initial = () => images.map((_, i) => count - i);
  const [spread, setSpread] = useState(false);
  const [layers, setLayers] = useState(initial);
  const prints = useRef<(HTMLElement | null)[]>([]);
  const offsets = useRef(images.map(() => ({ dx: 0, dy: 0 })));
  const drag = useRef<Drag | null>(null);

  const place = (index: number, dx: number, dy: number) => {
    const element = prints.current[index];
    if (!element) return;
    element.style.setProperty("--dx", `${dx}px`);
    element.style.setProperty("--dy", `${dy}px`);
  };
  const toggle = () => {
    offsets.current = images.map(() => ({ dx: 0, dy: 0 }));
    images.forEach((_, i) => place(i, 0, 0));
    setLayers(initial());
    setSpread((value) => !value);
  };

  const onPointerDown =
    (index: number) => (event: ReactPointerEvent<HTMLElement>) => {
      if (spread || event.button !== 0) return;
      const element = event.currentTarget;
      const area = element.parentElement;
      if (!area) return;
      const { dx, dy } = offsets.current[index];
      drag.current = {
        id: event.pointerId,
        index,
        x: event.clientX - dx,
        y: event.clientY - dy,
        dx,
        dy,
        bounds: area.getBoundingClientRect(),
        box: new DOMRect(
          element.offsetLeft,
          element.offsetTop,
          element.offsetWidth,
          element.offsetHeight,
        ),
      };
      setLayers((current) => {
        const highest = Math.max(...current);
        return current[index] === highest
          ? current
          : current.map((layer, i) => (i === index ? highest + 1 : layer));
      });
    };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const element = event.currentTarget;
    if (!element.hasPointerCapture(event.pointerId)) {
      if (
        Math.hypot(
          event.clientX - state.x - state.dx,
          event.clientY - state.y - state.dy,
        ) < 4
      )
        return;
      element.setPointerCapture(event.pointerId);
      element.setAttribute("data-dragging", "");
    }
    const { bounds, box } = state;
    // keep at least most of the print on the table
    const dx = Math.min(
      Math.max(event.clientX - state.x, -box.x - box.width * 0.3),
      bounds.width - box.x - box.width * 0.7,
    );
    const dy = Math.min(
      Math.max(event.clientY - state.y, -box.y - box.height * 0.25),
      bounds.height - box.y - box.height * 0.75,
    );
    state.dx = dx;
    state.dy = dy;
    place(state.index, dx, dy);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    offsets.current[state.index] = { dx: state.dx, dy: state.dy };
    event.currentTarget.removeAttribute("data-dragging");
  };

  return (
    <div className={t.table}>
      <div
        className={t.area}
        data-spread={spread ? "" : undefined}
        style={
          {
            "--pile-l": large.pileHeight,
            "--pile-s": small.pileHeight,
            "--grid-l": large.gridHeight,
            "--grid-s": small.gridHeight,
            "--cw-l": large.cell.w,
            "--ch-l": large.cell.h,
            "--cw-s": small.cell.w,
            "--ch-s": small.cell.h,
          } as CSSProperties
        }
      >
        {images.map((image, i) => {
          const l = large.pile[i];
          const m = small.pile[i];
          return (
            <figure
              key={image.src}
              ref={(element) => {
                prints.current[i] = element;
              }}
              className={t.print}
              style={
                {
                  "--x-l": l.x,
                  "--y-l": l.y,
                  "--w-l": l.w,
                  "--h-l": l.h,
                  "--r-l": l.r,
                  "--x-s": m.x,
                  "--y-s": m.y,
                  "--w-s": m.w,
                  "--h-s": m.h,
                  "--r-s": m.r,
                  "--gx-l": large.grid[i].x,
                  "--gy-l": large.grid[i].y,
                  "--gx-s": small.grid[i].x,
                  "--gy-s": small.grid[i].y,
                  zIndex: layers[i],
                } as CSSProperties
              }
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                src={image.src}
                srcSet={image.srcSet}
                sizes={image.sizes}
                width={image.width}
                height={image.height}
                alt={image.alt}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </figure>
          );
        })}
      </div>
      <div className={t.under}>
        {count > 1 && (
          <button
            type="button"
            className={`${s.button} ${t.toggle}`}
            aria-pressed={spread}
            onClick={toggle}
          >
            {spread ? <Pile /> : <Spread />}
            {spread ? labels.gather : labels.spread}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
