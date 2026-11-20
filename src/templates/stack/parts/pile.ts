"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const THROW = 64; // px a card must travel before letting go throws it
const TAP = 6; // px of movement still counted as a tap

type Move = { item: number; to: "back" | "front"; from: Keyframe; key: number };

/**
 * A pile of cards in an order. Position 0 is the top. Each card's pose at its position is
 * CSS's business (`data-p`, with `translate` and `rotate`); this hook only reorders and
 * animates the one card that changes place: pulled out to the side, then tucked under the
 * pile (`toBack`), or pulled from under it and laid on top (`toFront`). The others slide
 * into their new places with CSS transitions. The top card can also be thrown by drag.
 * Reduced motion reorders without the pull.
 */
export function usePile(
  count: number,
  {
    out,
    onTap,
  }: {
    /** Where a card is pulled to, relative to its place: a `translate` value and a `rotate`. */
    out: { translate: string; rotate: string };
    /** A tap on the top card that did not move it. */
    onTap?: () => void;
  },
) {
  const [order, setOrder] = useState(() =>
    Array.from({ length: count }, (_, i) => i),
  );
  const [move, setMove] = useState<Move | null>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const running = useRef<Animation | null>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const key = useRef(0);
  const dragged = useRef(false);

  const still = () =>
    typeof window === "undefined" || window.matchMedia(REDUCED).matches;
  const poseOf = (element: HTMLElement | null | undefined): Keyframe => {
    if (!element) return {};
    const style = getComputedStyle(element);
    return {
      translate: style.translate,
      rotate: style.rotate,
      transform: style.transform,
    };
  };

  const reorder = useCallback((item: number, to: "back" | "front") => {
    running.current?.finish();
    const from = poseOf(cards.current[item]);
    setOrder((current) => {
      const rest = current.filter((i) => i !== item);
      return to === "back" ? [...rest, item] : [item, ...rest];
    });
    setMove(still() ? null : { item, to, from, key: ++key.current });
  }, []);

  // Runs after the reorder has rendered: the moving card's CSS pose is already its new place
  // (its transition is off while it moves), so the animation runs from the old pose, out to
  // the side, and into the new one, crossing the pile halfway.
  useLayoutEffect(() => {
    if (!move) return;
    const element = cards.current[move.item];
    if (!element) return;
    const to = poseOf(element);
    const high = String(count + 2);
    const outFrame = {
      translate: out.translate,
      rotate: out.rotate,
      transform: "none",
    };
    const [first, second] = move.to === "back" ? [high, "0"] : ["0", high];
    const animation = element.animate(
      [
        { ...move.from, zIndex: first },
        { ...outFrame, zIndex: first, offset: 0.46 },
        { ...outFrame, zIndex: second, offset: 0.47 },
        { ...to, transform: "none", zIndex: second },
      ],
      { duration: 760, easing: "cubic-bezier(0.32, 0.72, 0.24, 1)" },
    );
    running.current = animation;
    const done = () => {
      if (running.current === animation) running.current = null;
      setMove((current) => (current?.key === move.key ? null : current));
    };
    animation.addEventListener("finish", done);
    animation.addEventListener("cancel", done);
    return () => {
      animation.removeEventListener("finish", done);
      animation.removeEventListener("cancel", done);
    };
  }, [move, count, out.translate, out.rotate]);

  useEffect(() => () => running.current?.cancel(), []);

  const top = order[0];
  const toBack = useCallback(() => reorder(order[0], "back"), [order, reorder]);
  const toFront = useCallback(
    (item: number) => item !== order[0] && reorder(item, "front"),
    [order, reorder],
  );
  const previous = useCallback(
    () => reorder(order[order.length - 1], "front"),
    [order, reorder],
  );

  // Drag: the top card follows the pointer (through `transform`, on top of its pose) and
  // is thrown under the pile past THROW px, or springs back.
  const setDrag = (
    element: HTMLElement,
    dx: number,
    dy: number,
    live: boolean,
  ) => {
    element.style.transform =
      dx || dy ? `translate(${dx}px, ${dy}px) rotate(${dx / 30}deg)` : "";
    element.toggleAttribute("data-dragging", live);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      event.button !== 0 ||
      (event.target as Element).closest("a, button:not([data-pile-handle])")
    )
      return;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      dy: 0,
    };
    dragged.current = false;
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    state.dx = event.clientX - state.x;
    state.dy = event.clientY - state.y;
    if (
      Math.hypot(state.dx, state.dy) < TAP &&
      !event.currentTarget.hasAttribute("data-dragging")
    )
      return;
    dragged.current = true;
    if (!event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.setPointerCapture(event.pointerId);
    setDrag(event.currentTarget, state.dx, state.dy * 0.6, true);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state || state.id !== event.pointerId) return;
    const element = event.currentTarget;
    const moved = Math.hypot(state.dx, state.dy);
    if (moved >= THROW && count > 1) {
      reorder(order[0], "back"); // reads the dragged pose as the start of the pull
      setDrag(element, 0, 0, false);
    } else {
      setDrag(element, 0, 0, false);
      if (moved < TAP && event.type === "pointerup") onTap?.();
    }
  };

  return {
    order,
    top,
    moving: move?.item ?? null,
    toBack,
    toFront,
    previous,
    /** True once after a gesture that moved the card, so its click can be ignored. */
    wasDragged: () => {
      const value = dragged.current;
      dragged.current = false;
      return value;
    },
    ref: (item: number) => (element: HTMLElement | null) => {
      cards.current[item] = element;
    },
    /** Pointer handlers for the top card. */
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
