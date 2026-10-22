"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { mediaDimensions } from "@/portfolio/media";
import type { PortfolioMediaAsset } from "@/portfolio/schema";
import "./screen-row.css";

export type ScreenFrame = "phone" | "none";

/** True while the element's content is wider than the element itself. */
function useHorizontalOverflow(element: React.RefObject<HTMLElement | null>) {
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = () =>
      setOverflowing(node.scrollWidth > node.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);
  return overflowing;
}

/**
 * App screens shown as one row, in the same order at every width. The row
 * fills its parent's width and takes none from its screens, so the parent
 * needs a width of its own (a shrink-to-fit parent would collapse it). When it
 * has room it shows up to three screens side by side, aligned top and bottom;
 * when it is narrow it shows two. Screens beyond what fits stay in the row: the
 * next one peeks in at the edge and the row scrolls sideways, snapping to each
 * screen. Only a row that actually scrolls becomes a keyboard stop.
 */
export function ScreenRow({
  screens,
  frame = "phone",
  label,
  sizes = "(max-width: 768px) 46vw, (max-width: 1200px) 25vw, 300px",
}: {
  screens: readonly PortfolioMediaAsset[];
  frame?: ScreenFrame;
  label: string;
  /** Rendered width of one screen, for picking the image size. */
  sizes?: string;
}) {
  const list = useRef<HTMLUListElement>(null);
  const scrollable = useHorizontalOverflow(list);
  if (!screens.length) return null;
  return (
    <div className={`screen-row screen-row--${frame}`}>
      <ul
        ref={list}
        className="screen-row__list"
        data-count={screens.length}
        data-scrollable={scrollable || undefined}
        aria-label={label}
        tabIndex={scrollable ? 0 : undefined}
      >
        {screens.map((screen, index) => (
          <li key={`${index}:${screen.src}`} className="screen-row__item">
            <div className="screen-row__frame">
              <Image
                src={screen.src}
                alt={screen.alt}
                {...mediaDimensions(screen.src)}
                sizes={sizes}
                draggable={false}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
