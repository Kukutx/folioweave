"use client";

import type { ReactNode, RefObject } from "react";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { InDialogHost } from "./dialog-host";
import styles from "./dialog.module.css";

/**
 * A native modal dialog in the page's dialog host: the page behind is
 * locked and inert, Tab stays inside, Escape or a click outside `children`
 * closes it, and focus returns to where it was.
 */
export function Modal({
  labelledBy,
  tone,
  initialFocus,
  onClose,
  className,
  children,
}: {
  labelledBy: string;
  tone: "light" | "dark";
  initialFocus: RefObject<HTMLElement | null>;
  onClose: () => void;
  className: string;
  children: ReactNode;
}) {
  const { dialogProps } = useModalDialog({ onClose, initialFocus });
  return (
    <InDialogHost>
      <dialog
        {...dialogProps}
        className={`${styles.dialog} ${styles[tone]}`}
        aria-labelledby={labelledBy}
        // The site's smooth scrolling stays out; the dialog scrolls natively.
        data-lenis-prevent=""
      >
        <div className={className} onClick={(event) => event.stopPropagation()}>
          {children}
        </div>
      </dialog>
    </InDialogHost>
  );
}
