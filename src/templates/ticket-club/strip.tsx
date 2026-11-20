"use client";

// The roll of tickets. Each ticket's body is a link: it opens the author's page. Its stub is a button:
// pull it sideways (mouse, pen or a finger) and it tears along the perforation, falls away, and the
// link is on the clipboard; a click, Enter or Space tears it off for you. The ticket is stamped, the
// line under the strip says what was kept, and "Print another" feeds a fresh stub. Without JavaScript
// every ticket is still a link and every stub still carries a scannable code of it.

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { copyText, fill, type Ticket } from "./data";
import { Qr, Roll, TicketFace } from "./ticket";
import t from "./strip.module.css";

export type StripLabels = {
  hintIdle: string;
  copyFailed: string;
  pull: string;
  taken: string;
  again: string;
  stubAction: string;
};

/** Copies text; resolves false when the browser refuses (no permission, no clipboard, insecure page). */
async function copy(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refused: try the older way below */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    const back = document.activeElement as HTMLElement | null;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    back?.focus?.({ preventScroll: true });
    return ok;
  } catch {
    return false;
  }
}

const still = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** how far (px) the stub is pulled before the perforation gives */
const GIVE = 84;
const pose = (dx: number) =>
  `translateX(${(dx * 0.32).toFixed(1)}px) rotate(${Math.min(dx * 0.2, 24).toFixed(2)}deg)`;

type Drag = {
  i: number;
  id: number;
  x0: number;
  y0: number;
  dx: number;
  live: boolean;
  el: HTMLElement;
};

export function Strip({
  tickets,
  labels,
  issuedBy,
  single = false,
  hint,
}: {
  tickets: Ticket[];
  labels: StripLabels;
  issuedBy: string;
  /** one ticket on its own (the end of an article), not a roll; its body is no link */
  single?: boolean;
  /** the line under the strip before anything is kept */
  hint?: string;
}) {
  const n = tickets.length;
  const [torn, setTorn] = useState<boolean[]>(() => tickets.map(() => false));
  const [line, setLine] = useState(hint ?? labels.hintIdle);
  const swing = useRef<HTMLDivElement>(null);
  const stubs = useRef<(HTMLButtonElement | null)[]>([]);
  const agains = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const busy = useRef<boolean[]>(tickets.map(() => false));
  const dragged = useRef(false);
  /** where focus goes once React has swapped a stub and its "Print another" */
  const focusNext = useRef<{ kind: "stub" | "again"; i: number } | null>(null);
  /** a stub printed anew feeds in from the right */
  const fed = useRef<number | null>(null);

  useEffect(() => {
    const f = focusNext.current;
    if (f) {
      focusNext.current = null;
      (f.kind === "stub" ? stubs.current[f.i] : agains.current[f.i])?.focus({
        preventScroll: true,
      });
    }
    const i = fed.current;
    if (i !== null) {
      fed.current = null;
      const el = stubs.current[i];
      if (el && !still())
        el.animate(
          [
            { transform: "translateX(26px)", opacity: 0 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
    }
  }, [torn]);

  /** The link goes to the clipboard at once, still inside the visitor's gesture (Safari insists). */
  const take = (i: number) => {
    const ticket = tickets[i];
    void copy(copyText(ticket.link)).then((ok) =>
      setLine(
        ok
          ? ticket.toast
          : fill(labels.copyFailed, { link: copyText(ticket.link) }),
      ),
    );
  };

  /** The stub gives: it falls, the strip swings, and the ticket is stamped. */
  const fall = (i: number, from: string) => {
    const el = stubs.current[i];
    const done = () => {
      busy.current[i] = false;
      // the stub is about to go: if it held the focus, "Print another" takes it
      if (el && document.activeElement === el)
        focusNext.current = { kind: "again", i };
      setTorn((all) => all.map((v, j) => (j === i ? true : v)));
    };
    if (!el || still()) return done();
    const li = el.closest("li");
    li?.setAttribute("data-falling", "");
    const drop = el.animate(
      [
        { transform: from, opacity: 1 },
        {
          transform: "translate(64px, 120px) rotate(38deg)",
          opacity: 1,
          offset: 0.55,
        },
        { transform: "translate(110px, 300px) rotate(74deg)", opacity: 0 },
      ],
      { duration: 820, easing: "cubic-bezier(.4,0,.9,.55)", fill: "forwards" },
    );
    swing.current?.animate(
      [
        { transform: "none" },
        { transform: "rotate(-1.3deg)" },
        { transform: "rotate(0.8deg)" },
        { transform: "rotate(-0.35deg)" },
        { transform: "none" },
      ],
      { duration: 1300, easing: "ease-out" },
    );
    drop.onfinish = () => {
      li?.removeAttribute("data-falling");
      done();
    };
  };

  /** A click, Enter or Space: the stub is pulled for you, then gives. A pointer's click that ends a
   * drag is not one: the drag has already done (or undone) the tear. */
  const tear = (i: number, pointer = false) => {
    const afterDrag = dragged.current;
    dragged.current = false;
    if (afterDrag && pointer) return;
    if (busy.current[i] || torn[i]) return;
    busy.current[i] = true;
    take(i);
    const el = stubs.current[i];
    if (!el || still()) return fall(i, "none");
    const end = pose(GIVE * 0.9);
    const pull = el.animate([{ transform: "none" }, { transform: end }], {
      duration: 240,
      easing: "cubic-bezier(.5,0,.75,0)",
      fill: "forwards",
    });
    pull.onfinish = () => {
      el.style.transform = end;
      pull.cancel();
      fall(i, end);
    };
  };

  const onDown = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || torn[i] || busy.current[i]) return;
    dragged.current = false;
    drag.current = {
      i,
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      dx: 0,
      live: false,
      el: e.currentTarget,
    };
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.live) {
      if (Math.hypot(dx, dy) < 6) return;
      // a pull to the right is a tear; anything else is the page scrolling or a change of mind
      if (dx <= 0 || Math.abs(dy) > Math.abs(dx) * 1.2) {
        drag.current = null;
        return;
      }
      d.live = true;
      dragged.current = true;
      d.el.setPointerCapture(e.pointerId);
      d.el.dataset.pulling = "";
    }
    d.dx = Math.max(0, dx);
    const at = pose(d.dx);
    d.el.style.transform = at;
    if (d.dx >= GIVE) {
      drag.current = null;
      delete d.el.dataset.pulling;
      busy.current[d.i] = true;
      take(d.i);
      fall(d.i, at);
    }
  };
  const onUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.live) return;
    delete d.el.dataset.pulling;
    // let go before it gave: the stub springs back into place
    const from = d.el.style.transform;
    d.el.style.transform = "";
    if (!still())
      d.el.animate([{ transform: from }, { transform: "none" }], {
        duration: 420,
        easing: "cubic-bezier(.3,1.5,.5,1)",
      });
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      tear(Number(e.currentTarget.dataset.i));
    }
  };

  const face = (ticket: Ticket, i: number) => ({
    serial: ticket.serial,
    index: single
      ? undefined
      : `${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`,
    kicker: ticket.kicker,
    title: ticket.title,
    address: ticket.address,
    issuedBy,
    external: ticket.external,
    arrow: !single,
  });

  const again = (i: number) => {
    fed.current = i;
    focusNext.current = { kind: "stub", i };
    setTorn((all) => all.map((v, j) => (j === i ? false : v)));
  };

  return (
    <div className={`${t.strip} ${single ? t.single : ""}`}>
      {!single && <Roll />}
      <div ref={swing} className={t.swing}>
        <ol className={t.feed}>
          {tickets.map((ticket, i) => (
            <li
              key={ticket.link + i}
              className={t.ticket}
              data-torn={torn[i] ? "" : undefined}
            >
              <div className={t.paper}>
                {single ? (
                  <div className={t.body}>
                    <TicketFace {...face(ticket, i)} />
                  </div>
                ) : (
                  <a
                    className={t.body}
                    href={ticket.link}
                    {...(ticket.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    <TicketFace {...face(ticket, i)} />
                  </a>
                )}
                {!torn[i] && (
                  <button
                    ref={(el) => {
                      stubs.current[i] = el;
                    }}
                    type="button"
                    className={t.stub}
                    data-i={i}
                    // The name starts with the words the stub shows (WCAG 2.5.3).
                    aria-label={`${ticket.stub}, ${labels.pull}: ${fill(labels.stubAction, {
                      link:
                        ticket.label === ticket.address
                          ? ticket.address
                          : `${ticket.label} (${ticket.address})`,
                    })}`}
                    onPointerDown={onDown(i)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                    onKeyDown={onKey}
                    onClick={(e) => tear(i, e.detail > 0)}
                  >
                    <span className={t.stubHead} aria-hidden>
                      {ticket.stub}
                    </span>
                    <Qr text={ticket.link} />
                    <span className={t.stubFoot} aria-hidden>
                      <span className={t.serial}>{ticket.serial}</span>
                      <span>{labels.pull} →</span>
                    </span>
                  </button>
                )}
              </div>
              <span className={t.stamp} aria-hidden>
                {labels.taken}
              </span>
              {torn[i] && (
                <button
                  ref={(el) => {
                    agains.current[i] = el;
                  }}
                  type="button"
                  className={t.again}
                  aria-label={`${labels.again}: ${ticket.label}`}
                  onClick={() => again(i)}
                >
                  <svg viewBox="0 0 20 20" aria-hidden>
                    <path d="M15.5 7.5A6 6 0 1 0 16 12M16 3.5v4h-4" />
                  </svg>
                  <span>{labels.again}</span>
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>
      <p className={t.hint} role="status">
        <span aria-hidden>↳</span> {line}
      </p>
    </div>
  );
}
