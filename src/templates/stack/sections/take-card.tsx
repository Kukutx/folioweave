"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Copy } from "../parts/icons";
import s from "../stack.module.css";
import k from "./contact.module.css";

const REDUCED = "(prefers-reduced-motion: reduce)";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // clipboard blocked (permissions, insecure context): a selection copy instead
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.append(area);
    area.select();
    let done = false;
    try {
      done = document.execCommand("copy");
    } catch {}
    area.remove();
    return done;
  }
}

/** The top calling card. Copying the address takes the card off the stack (the visitor
 * keeps it) and the next one, the same, lies there in its place. */
export function TakeCard({
  className,
  email,
  labels,
  actions,
  children,
}: {
  className: string;
  email: string;
  labels: { copy: string; copied: string };
  actions?: ReactNode;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const take = async () => {
    const done = await copyText(email);
    if (!done) {
      window.location.href = `mailto:${email}`;
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2400);
    if (!card.current || window.matchMedia(REDUCED).matches) return;
    card.current.getAnimations().forEach((animation) => animation.cancel());
    card.current.animate(
      [
        { translate: "0 0", rotate: "0deg", opacity: 1 },
        { translate: "18% 46%", rotate: "9deg", opacity: 1, offset: 0.32 },
        { translate: "34% 120%", rotate: "16deg", opacity: 0, offset: 0.5 },
        { translate: "6px 10px", rotate: "1.2deg", opacity: 0, offset: 0.51 },
        { translate: "6px 10px", rotate: "1.2deg", opacity: 1, offset: 0.6 },
        { translate: "0 0", rotate: "0deg", opacity: 1 },
      ],
      { duration: 1200, easing: "cubic-bezier(0.3, 0.6, 0.25, 1)" },
    );
  };

  return (
    <>
      <div ref={card} className={className}>
        {children}
      </div>
      {(email || actions) && (
        <div className={k.actions}>
          {actions}
          {email && (
            <button type="button" className={s.button} onClick={take}>
              <Copy />
              {copied ? labels.copied : labels.copy}
            </button>
          )}
          <span className={s.visuallyHidden} aria-live="polite">
            {copied ? `${labels.copied}: ${email}` : ""}
          </span>
        </div>
      )}
    </>
  );
}
