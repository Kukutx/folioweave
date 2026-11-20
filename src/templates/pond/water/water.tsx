"use client";

// The pond as a control: a button that drops food on the water (a click or a tap where it lands, Enter or Space
// somewhere open). Its children are the still scene the server rendered; once the page is interactive the live
// pond loads, takes the scene over and hides it. Without JavaScript, or until then, the still is the pond.

import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useOpening } from "@/hooks/use-opening";
import type { Pond } from "./engine";
import s from "./water.module.css";

export function Water({
  label,
  className,
  children,
}: {
  /** accessible name of the pond, which is a button: pressing it feeds the koi */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLElement>(null);
  const pondRef = useRef<Pond | null>(null);
  // the koi come up into view with the first paint (water.module.css); the attribute goes once that has played
  const [opening] = useOpening(rootRef, "pond-");

  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current, probe = probeRef.current;
    if (!root || !canvas || !probe || !canvas.getContext) return;
    // the page the pond belongs to: the text over it (marked data-pond-avoid) and the "fed" state live there
    const page = root.closest<HTMLElement>("[data-pond-page]") ?? root.parentElement ?? root;
    let gone = false;
    void import("./engine").then(({ Pond }) => {
      if (gone) return;
      pondRef.current = new Pond(root, canvas, probe, {
        avoid: () => [...page.querySelectorAll("[data-pond-avoid]")],
        onFeed: () => page.setAttribute("data-fed", ""),
      });
    });
    return () => {
      gone = true;
      pondRef.current?.destroy();
      pondRef.current = null;
    };
  }, []);

  const local = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div
      ref={rootRef}
      className={className ? `${s.water} ${className}` : s.water}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-opening={opening ? "" : undefined}
      onPointerDown={(e) => {
        const pond = pondRef.current;
        if (!pond || (e.pointerType === "mouse" && e.button !== 0)) return;
        const [x, y] = local(e);
        if (pond.pointerDown(e.pointerId, x, y, e.pointerType === "touch")) {
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.style.cursor = "grabbing";
        }
      }}
      onPointerMove={(e) => {
        const pond = pondRef.current;
        if (!pond) return;
        const [x, y] = local(e);
        pond.pointerMove(e.pointerId, x, y, e.pointerType === "mouse");
        if (e.pointerType === "mouse") e.currentTarget.style.cursor = pond.cursorAt(x, y);
      }}
      onPointerUp={(e) => {
        const pond = pondRef.current;
        if (!pond) return;
        const [x, y] = local(e);
        pond.pointerUp(e.pointerId, x, y);
        if (e.pointerType === "mouse") e.currentTarget.style.cursor = pond.cursorAt(x, y);
      }}
      onPointerCancel={(e) => pondRef.current?.pointerCancel(e.pointerId)}
      onPointerLeave={() => pondRef.current?.pointerLeave()}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        pondRef.current?.dropSomewhere();
      }}
    >
      {children}
      <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" />
      <i ref={probeRef} className={s.probe} aria-hidden="true" />
    </div>
  );
}
