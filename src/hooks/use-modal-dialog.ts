"use client";

import {
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { flushSync } from "react-dom";
import { lockPageScroll } from "@/lib/scroll-lock";

const TAB_STOPS =
  'a[href], button:not([disabled]):not([hidden]), [tabindex="0"]';

/**
 * A full-screen viewer on a native modal `<dialog>`, for components mounted
 * only while the viewer is open (inside AnimatePresence, so they can fade
 * out):
 *
 * - the page behind is locked and inert, and Tab cycles inside the dialog;
 * - focus moves to `initialFocus`, and on close returns to `returnFocus`, or
 *   else to whatever had it before;
 * - Escape closes at once (`keyboardClosing` turns the exit instant), a click
 *   on the dialog itself closes it, and `onKey` sees every other key;
 * - a classic scrollbar's gutter is covered: size the dialog with
 *   `--modal-scrollbar-width`, and pass `gutterColor` to paint the gutter
 *   while the dialog owns it.
 *
 * Spread `dialogProps` on the dialog.
 */
export function useModalDialog({
  onClose,
  initialFocus,
  returnFocus,
  gutterColor,
  onKey,
}: {
  onClose: () => void;
  initialFocus: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  gutterColor?: string;
  onKey?: (event: KeyboardEvent) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [keyboardClosing, setKeyboardClosing] = useState(false);
  const keyDown = useEffectEvent((event: KeyboardEvent) => onKey?.(event));

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus =
      returnFocus?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    const root = document.documentElement;
    const rootBackground = root.style.backgroundColor;
    const rootBackgroundPriority =
      root.style.getPropertyPriority("background-color");
    // Reserve only an existing classic scrollbar; touch and overlay
    // scrollbars keep their normal page width.
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    // A root :has() selector would invalidate document-wide styles on every
    // open and close, so the gutter is painted inline.
    const paintGutter = Boolean(gutterColor) && scrollbarWidth > 0;
    if (paintGutter) root.style.backgroundColor = gutterColor!;
    const releaseScroll = lockPageScroll();
    dialog?.style.setProperty("--modal-scrollbar-width", `${scrollbarWidth}px`);
    dialog?.showModal();
    initialFocus.current?.focus({ preventScroll: true });

    const key = (event: KeyboardEvent) => {
      // Native modality makes the page inert; wrapping keeps Tab in the
      // dialog instead of moving into the browser chrome at the edge.
      if (event.key === "Tab" && dialog) {
        const stops = [...dialog.querySelectorAll<HTMLElement>(TAB_STOPS)];
        const first = stops[0];
        const last = stops.at(-1);
        if (
          first &&
          last &&
          ((event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last))
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
        return;
      }
      keyDown(event);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      dialog?.close();
      if (paintGutter) {
        if (rootBackground)
          root.style.setProperty(
            "background-color",
            rootBackground,
            rootBackgroundPriority,
          );
        else root.style.removeProperty("background-color");
      }
      releaseScroll();
      previousFocus?.focus({ preventScroll: true });
    };
  }, [gutterColor, initialFocus, returnFocus]);

  // Native cancel (Escape) is outside React's discrete-event priority: commit
  // the instant exit and the parent's unmount together, so Escape reaches its
  // next paint without scheduler latency.
  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    flushSync(() => {
      setKeyboardClosing(true);
      onClose();
    });
  };

  return {
    dialogRef,
    keyboardClosing,
    dialogProps: { ref: dialogRef, onCancel, onClick: onClose },
  };
}
