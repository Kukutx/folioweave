"use client";

import { useRef, type ReactNode } from "react";
import { useOpening } from "@/hooks/use-opening";

/**
 * The cover's opening: CSS keyframes that start with the first paint (styled under
 * `[data-opening]` in cover.module.css), so nothing waits for hydration. The attribute is
 * kept only until those animations finish, so a later change of preference or a print
 * never replays them.
 */
export function Opening({
  className,
  id,
  children,
}: {
  className: string;
  id?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  // every CSS animation inside the cover belongs to the opening
  const [playing] = useOpening(ref);
  return (
    <header
      ref={ref}
      id={id}
      className={className}
      data-opening={playing ? "" : undefined}
    >
      {children}
    </header>
  );
}
