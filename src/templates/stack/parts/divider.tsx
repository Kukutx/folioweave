import type { CSSProperties, ReactNode } from "react";
import s from "../stack.module.css";

/** The section's title on a divider's tab. The tab sits at the same place along the edge
 * as in the stack of tabs at the top of the page, in the same tint. */
export function Divider({
  slot,
  slots,
  tint,
  id,
  children,
}: {
  slot: number;
  slots: number;
  tint: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={s.divider}
      style={
        {
          "--tint": `var(--tint-${tint})`,
          "--slots": slots,
          "--before": slot,
          "--after": Math.max(0, slots - 1 - slot),
        } as CSSProperties
      }
    >
      <h2 className={s.tab} id={id}>
        <span className={s.tabNumber} aria-hidden="true">
          {String(slot + 1).padStart(2, "0")}
        </span>
        {children}
      </h2>
    </div>
  );
}
