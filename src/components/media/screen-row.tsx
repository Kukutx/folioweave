"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { useViewReveal } from "@/hooks/use-view-reveal";
import { mediaDimensions } from "@/portfolio/media";
import type { PortfolioMediaAsset } from "@/portfolio/schema";
import "./screen-row.css";

export type ScreenFrame = "phone" | "none";

const ease = [0.22, 1, 0.36, 1] as const;

// The screens rise in one after another when the row scrolls into view. The
// server renders them in place; see useViewReveal.
const rowVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};
const screenVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } },
};

type RowState = { scrollable: boolean; index: number };

/** Whether the row scrolls, and which screen its scroll position starts at. */
function useRowScroll(list: React.RefObject<HTMLUListElement | null>) {
  const [state, setState] = useState<RowState>({
    scrollable: false,
    index: 0,
  });
  useEffect(() => {
    const node = list.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const step = screenStep(node);
      const max = node.scrollWidth - node.clientWidth;
      const scrollable = max > 1;
      const index = scrollable
        ? Math.min(Math.round(max / step), Math.round(node.scrollLeft / step))
        : 0;
      setState((current) =>
        current.scrollable === scrollable && current.index === index
          ? current
          : { scrollable, index },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    node.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      node.removeEventListener("scroll", schedule);
    };
  }, [list]);
  return state;
}

/** Distance between the starts of two neighbouring screens. */
function screenStep(list: HTMLElement) {
  const [first, second] = list.children as HTMLCollectionOf<HTMLElement>;
  return second
    ? second.offsetLeft - first.offsetLeft
    : Math.max(1, list.clientWidth);
}

/**
 * App screens shown as one row, in the same order at every width. The row
 * fills its parent's width and takes none from its screens, so the parent
 * needs a width of its own (a shrink-to-fit parent would collapse it).
 *
 * Wide rows show three screens side by side, aligned top and bottom; narrow
 * ones (phones) show two, and the rest is a swipe away, with dots that follow
 * the swipe and can be tapped. Screens rise in one after another when the row
 * comes into view, a screen lifts under the pointer, and a row that scrolls is
 * a keyboard stop. With reduced motion everything is simply in place.
 */
export function ScreenRow({
  screens,
  frame = "phone",
  label,
  sizes = "(max-width: 767px) 48vw, (max-width: 1200px) 25vw, 300px",
}: {
  screens: readonly PortfolioMediaAsset[];
  frame?: ScreenFrame;
  label: string;
  /** Rendered width of one screen, for picking the image size. */
  sizes?: string;
}) {
  const list = useRef<HTMLUListElement>(null);
  const { scrollable, index } = useRowScroll(list);
  const reveal = useViewReveal(list);
  const reducedMotion = usePrefersReducedMotion();
  const show = useCallback(
    (position: number) => {
      const node = list.current;
      if (!node) return;
      node.scrollTo({
        left: position * screenStep(node),
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion],
  );
  if (!screens.length) return null;
  // Positions a narrow row can stop at (two in view); a wide row has one
  // fewer, and CSS hides the last dot there.
  const positions = Math.max(0, screens.length - 1);
  return (
    <div className={`screen-row screen-row--${frame}`}>
      <motion.ul
        ref={list}
        className="screen-row__list"
        data-count={screens.length}
        data-scrollable={scrollable || undefined}
        aria-label={label}
        tabIndex={scrollable ? 0 : undefined}
        variants={rowVariants}
        initial={false}
        animate={reveal}
      >
        {screens.map((screen, position) => (
          <motion.li
            key={`${position}:${screen.src}`}
            className="screen-row__item"
            variants={screenVariants}
          >
            <div className="screen-row__frame">
              <Image
                src={screen.src}
                alt={screen.alt}
                {...mediaDimensions(screen.src)}
                sizes={sizes}
                draggable={false}
              />
            </div>
          </motion.li>
        ))}
      </motion.ul>
      {positions > 1 && (
        <div className="screen-row__dots" data-count={screens.length}>
          {Array.from({ length: positions }, (_, position) => (
            <button
              key={position}
              type="button"
              className="screen-row__dot"
              aria-label={`Show screen ${position + 1} of ${screens.length}`}
              aria-current={position === index ? "true" : undefined}
              onClick={() => show(position)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
