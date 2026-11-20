// The printed parts of a ticket, shared by the roll on the home page, the ticket that ends each article
// and the void ticket of the missing page. Markup only: no state, usable on the server and the client.

import type { CSSProperties } from "react";
import { qrPath } from "./qr";
import t from "./strip.module.css";

/** Roughly how wide a line is, in ems of League Gothic set in capitals (CJK and other scripts wider). */
export function emWidth(line: string) {
  let w = 0;
  for (const c of line.toLocaleUpperCase()) {
    if (c === " ") w += 0.2;
    else if (/[⺀-鿿가-힯豈-﫿＀-￯]/.test(c)) w += 1;
    else if (/[A-Z0-9]/.test(c))
      w += /[MW]/.test(c) ? 0.52 : /[IJ1]/.test(c) ? 0.24 : 0.42;
    else w += 0.36;
  }
  return Math.max(1, w);
}

/** The title's size, so the longest line fits the card. */
export const titleStyle = (title: string[]) =>
  ({ "--tw": Math.max(...title.map(emWidth)).toFixed(2) }) as CSSProperties;

export const Arrow = ({ external }: { external?: boolean }) => (
  <svg className={t.arrow} viewBox="0 0 20 20" aria-hidden>
    {external ? (
      <path d="M5 15 15 5M7 5h8v8" />
    ) : (
      <path d="M3 10h13M11 5l5 5-5 5" />
    )}
  </svg>
);

/** A real, scannable code of the link (nothing when the link is too long to carry whole). */
export function Qr({ text }: { text: string }) {
  const qr = qrPath(text);
  if (!qr) return null;
  const q = 1; // a narrow quiet zone; the stub's own margin completes it
  return (
    <svg
      className={t.qr}
      viewBox={`${-q} ${-q} ${qr.size + 2 * q} ${qr.size + 2 * q}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <path d={qr.d} />
    </svg>
  );
}

/** The roll the strip comes off: a spindle and a cylinder of card, its end showing the turns. */
export const Roll = () => (
  <div className={t.roll} aria-hidden>
    <span className={t.rod} />
    <span className={t.cylinder} />
    <span className={t.end} />
  </div>
);

type Face = {
  serial: string;
  index?: string;
  kicker: string;
  title: string[];
  address: string;
  issuedBy: string;
  external?: boolean;
  /** the arrow of a ticket that is a link */
  arrow?: boolean;
  /** heading level for the title, when the ticket is the page's heading */
  as?: "h1" | "h2";
};

/** The printed face of a ticket's body. */
export function TicketFace({
  serial,
  index,
  kicker,
  title,
  address,
  issuedBy,
  external,
  arrow = true,
  as,
}: Face) {
  const Title = as ?? "span";
  return (
    <>
      <span className={t.row} aria-hidden>
        <span className={t.serial}>No. {serial}</span>
        {index && <span>{index}</span>}
      </span>
      <span className={t.kicker}>{kicker} </span>
      <Title
        className={`${t.title} ${title.length > 1 ? t.two : ""}`}
        style={titleStyle(title)}
      >
        {title.map((line, i) => (
          <span key={i}>
            {line}
            {i < title.length - 1 ? " " : ""}
          </span>
        ))}
      </Title>
      <span className={t.address}> {address}</span>
      <span className={t.foot} aria-hidden>
        <span>{issuedBy}</span>
        {arrow && <Arrow external={external} />}
      </span>
    </>
  );
}
