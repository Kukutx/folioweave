"use client";

import type { CSSProperties } from "react";
import type { ImageSet } from "../parts/image";
import { usePile } from "../parts/pile";
import c from "./cover.module.css";

const OUT = { translate: "120% -18%", rotate: "16deg" };

/** The portraits as a small pile of prints: a tap (or a throw) tucks the top one under. */
export function Portraits({
  prints,
  label,
}: {
  prints: ImageSet[];
  label: string;
}) {
  const pile = usePile(prints.length, { out: OUT });
  const many = prints.length > 1;
  const body = prints.map((print, i) => {
    const p = pile.order.indexOf(i);
    return (
      <span
        key={print.src}
        ref={pile.ref(i)}
        className={c.print}
        data-p={Math.min(p, 3)}
        data-moving={pile.moving === i ? "" : undefined}
        style={{ zIndex: prints.length - p } as CSSProperties}
        {...(p === 0 && many ? pile.handlers : {})}
      >
        <img
          src={print.src}
          srcSet={print.srcSet}
          sizes={print.sizes}
          width={print.width}
          height={print.height}
          alt=""
          draggable={false}
          decoding="async"
          fetchPriority={i === 0 ? "high" : "low"}
        />
      </span>
    );
  });
  if (!many) return <div className={c.pile}>{body}</div>;
  const position = `${pile.top + 1} / ${prints.length}`;
  return (
    <div className={c.pileBox}>
      <button
        type="button"
        className={c.pile}
        data-pile-handle=""
        aria-label={`${label}, ${position}`}
        onClick={() => {
          if (!pile.wasDragged()) pile.toBack();
        }}
      >
        {body}
      </button>
      <span className={c.count} aria-hidden="true">
        {position}
      </span>
    </div>
  );
}
