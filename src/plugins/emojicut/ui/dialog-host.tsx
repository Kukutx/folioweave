"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/*
 * Dialogs render at the page root rather than where they are opened, so they
 * inherit the page's fonts and colour tokens wherever they were opened from.
 * As native modal dialogs they then sit in the top layer, above the site's
 * floating controls (music, launcher).
 */
export const DialogHostContext = createContext<HTMLElement | null>(null);

export function InDialogHost({ children }: { children: ReactNode }) {
  const host = useContext(DialogHostContext);
  return host ? createPortal(children, host) : children;
}
