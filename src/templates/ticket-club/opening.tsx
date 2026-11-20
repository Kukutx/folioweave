"use client";

import { useRef, type ReactNode } from "react";
import { useOpening } from "@/hooks/use-opening";

/** The bill's opening: CSS keyframes under [data-opening] play from the first paint (see
 * bill.module.css and strip.module.css); the attribute is dropped once they have finished, so a later
 * change of preference or a print never replays them. */
export function Opening({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing] = useOpening(ref);
  return (
    <div
      ref={ref}
      className={className}
      data-opening={playing ? "" : undefined}
    >
      {children}
    </div>
  );
}
