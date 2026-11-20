// The page's header as the original sets it: the asterisk and "YOUR LITTLE / LINK COLLECTION" on the left,
// "PERSONAL EDITION ↗" on the right (with × while the edition is open). On a wide screen it sits on the
// 1500-wide stage (DeskHead, stage px); on a phone it is a row of its own (PhoneHead). No hooks: it renders
// on the server and inside the line's client island alike.

import Link from "next/link";
import type { CSSProperties } from "react";
import { EDITION, LOGO, PAGE_TXT, type T4 } from "./geometry";
import { ArrowNE, Asterisk, CrossIcon } from "./parts";
import { mono } from "./fonts";
import s from "./ticket-club.module.css";

export type HeadProps = {
  brandTop: string;
  brandBottom: string;
  edition: string;
  /** where "PERSONAL EDITION" goes: the edition (↗), or back to the line from inside it (×) */
  editionHref: string | null;
  open?: boolean;
  /** an accessible name for the × link */
  closeLabel?: string;
  /** the brand links home (on every page but the line itself) */
  home?: boolean;
};

const line = (p: T4, text: string) => (
  <div className={`${s.line} ${mono.className} ${s.w500}`}
    style={{ left: p[0], top: p[1], fontSize: p[2], letterSpacing: p[3], color: "rgb(248,184,156)" }}>{text}</div>
);

function EditionLink({ p, cls, style }: { p: HeadProps; cls: string; style?: CSSProperties }) {
  if (!p.editionHref) return null;
  return (
    <Link className={`${s.edition} ${cls}`} style={style} href={p.editionHref}
      aria-label={p.open && p.closeLabel ? `${p.edition} — ${p.closeLabel}` : undefined}>
      <span>{p.edition}</span>{p.open ? <CrossIcon color="rgb(255,194,158)" /> : <ArrowNE color="rgb(255,194,158)" />}
    </Link>
  );
}

/** The header on the stage (stage px). */
export function DeskHead(p: HeadProps) {
  const brand = (
    <>
      <div className={s.icon} style={{ left: LOGO.x, top: LOGO.y, width: LOGO.s, height: LOGO.s }}>
        <Asterisk size={LOGO.s} color="rgb(244,190,154)" w={1.15} />
      </div>
      {line(PAGE_TXT.little, p.brandTop)}
      {line(PAGE_TXT.coll, p.brandBottom)}
    </>
  );
  return (
    <div className={s.deskOnly}>
      {p.home ? (
        <Link href="/" className={s.homeLink} style={{ left: LOGO.x - 4, top: LOGO.y - 4, width: 140, height: LOGO.s + 8 }}>
          <div className={s.homeIn} style={{ left: 4 - LOGO.x, top: 4 - LOGO.y }}>{brand}</div>
          <span className={s.srOnly}>{`${p.brandTop} ${p.brandBottom}`}</span>
        </Link>
      ) : brand}
      <EditionLink p={p} cls={s.editionDesk} style={{ left: EDITION.x, top: EDITION.y, width: EDITION.w, height: EDITION.h }} />
    </div>
  );
}

/** The header as a row of its own (phones). */
export function PhoneHead(p: HeadProps) {
  const inner = (
    <>
      <Asterisk size={24} color="rgb(244,190,154)" w={1.2} />
      <span className={s.brandText}>{p.brandTop}<br />{p.brandBottom}</span>
    </>
  );
  return (
    <header className={`${s.phoneHead} ${mono.className}`}>
      {p.home ? <Link href="/" className={s.brand}>{inner}</Link> : <span className={s.brand}>{inner}</span>}
      <EditionLink p={p} cls="" />
    </header>
  );
}

/** Both headers for a page off the stage: the desk one on a header-high strip of the stage. */
export function PageHead(p: HeadProps) {
  return (
    <>
      <PhoneHead {...p} />
      <div className={s.edHead}>
        <div className={s.edHeadStage}><DeskHead {...p} /></div>
      </div>
    </>
  );
}
