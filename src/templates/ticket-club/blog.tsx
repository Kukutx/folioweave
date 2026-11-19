// Writing and the 404 in Ticket Club's language: the red page with its backdrop and header; articles listed
// as tickets (a card with its perforation, a stub that reads "READ IT"), an article on the edition's
// letter paper. Server components only.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { BlogPostSummary } from "@/blog/types";
import type { TemplateContext } from "@/core/contracts";
import { tagHref } from "@/blog/taxonomy.mjs";
import { CARD_C, DIAMOND, HOLES } from "./geometry";
import { clubLabels, editionPathOf, letterOf, type ClubLabels } from "./data";
import { Asterisk, Backdrop, Barcode, Diamond, Glyph } from "./parts";
import { PageHead } from "./header";
import { cond, inter, mono } from "./fonts";
import s from "./ticket-club.module.css";
import b from "./blog.module.css";

/** The red page with the header; the brand goes home, "PERSONAL EDITION ↗" to the letter. */
export function Shell({ context, children, className }: { context: TemplateContext; children: ReactNode; className?: string }) {
  const L = clubLabels(context);
  const edition = letterOf(context) ? `/${editionPathOf(context)}` : null;
  return (
    <div className={`${s.page} ${mono.className} ${b.page}`}>
      <Backdrop />
      <div className={b.shell}>
        <PageHead brandTop={L.brandTop} brandBottom={L.brandBottom} edition={L.edition} editionHref={edition} home />
        <main id="main" className={`${b.main} ${className ?? ""}`}>{children}</main>
      </div>
    </div>
  );
}

/** The page's heading block, as the line's hero text sets it (tagline with a dot, condensed title, sub). */
export function Heading({ tagline, title, sub, level = 1 }: { tagline: string; title: string; sub?: string; level?: 1 | 2 }) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <header className={b.heading}>
      <p className={`${s.tagline} ${b.tagline}`}><i className={s.dot} />{tagline}</p>
      <H className={`${s.title} ${cond.className} ${b.title}`}>
        {title}
        <span className={b.ast}><Asterisk size={46} color="rgb(241,204,163)" w={1.5} /></span>
      </H>
      {sub && <p className={`${s.sub} ${inter.className} ${b.sub}`}>{sub}</p>}
    </header>
  );
}

const holes = (y: string) => {
  const m = `radial-gradient(circle at ${HOLES.pitch / 2}px ${y}, transparent ${HOLES.r}px, #000 ${HOLES.r + 0.5}px) ${HOLES.u0 - HOLES.pitch / 2}px 0 / ${HOLES.pitch}px 100% repeat-x`;
  return { WebkitMask: m, mask: m } as CSSProperties;
};
const CARD_MASK = holes("100%");
const STUB_MASK = holes("0.5px");

/** A ticket that is a link: the card (number, kicker, title, line, name, date) and its stub. */
export function TicketLink(p: {
  href: string; n: string; corner: string; kind: string; title: string; sub?: string; name: string; date: string;
  take: string; url: string; pull: string; light?: boolean; tilt?: number; club: string; headingLevel?: 1 | 2;
}) {
  const ink = p.light ? ["rgb(5,29,25)", "rgb(19,56,50)", "rgb(36,83,76)"] : ["rgb(204,245,236)", "rgb(190,226,218)", "rgb(180,214,205)"];
  const H = p.headingLevel === 1 ? "h1" : "h2";
  return (
    <Link href={p.href} className={b.ticket} style={{ "--tilt": `${p.tilt ?? 0}deg` } as CSSProperties}>
      <span className={b.card} style={{ ...CARD_MASK, "--card": p.light ? CARD_C.light.card : CARD_C.dark.card } as CSSProperties}>
        <span className={b.cardTop}>
          <span className={b.small}>TC / {p.n}</span>
          <span className={b.small}>{p.corner}</span>
        </span>
        <span className={`${b.club} ${cond.className}`}>{p.club}</span>
        <span className={b.diamond} style={{ aspectRatio: `${DIAMOND.w} / ${DIAMOND.h}` }}><Diamond light={p.light} /></span>
        <span className={b.kind}>{p.n} / {p.kind}</span>
        <H className={`${b.cardTitle} ${cond.className}`}>{p.title}</H>
        {p.sub && <span className={`${b.cardSub} ${inter.className}`}>{p.sub}</span>}
        <span className={b.rule} />
        <span className={b.cardFoot}>
          <span className={b.name}>{p.name}</span>
          <span>{p.date}</span>
        </span>
      </span>
      <span className={b.stub} style={{ ...STUB_MASK, background: p.light ? CARD_C.light.stub : CARD_C.dark.stub, color: ink[0] }}>
        <span className={`${b.take} ${inter.className}`}>{p.take}</span>
        <span className={b.url} style={{ color: ink[1] }}>{p.url}</span>
        <span className={b.arrow}><Glyph name="arrowSE" size={30.8} color={ink[0]} w={1.15} /></span>
        <span className={b.barcode}><Barcode color={ink[0]} /></span>
        <span className={b.pull} style={{ color: ink[2] }}>{p.pull}</span>
      </span>
    </Link>
  );
}

const dateOf = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T00:00:00Z`),
  );
// a ticket's tilt on the board, as the line hangs them (first, middle, last)
const TILTS = [-1.6, 0.6, 1.4, -0.6];

export function PostTickets({ posts, context, labels }: { posts: readonly BlogPostSummary[]; context: TemplateContext; labels: ClubLabels }) {
  const locale = context.site.identity.locale;
  const name = context.site.identity.name.toLocaleUpperCase(locale);
  const host = context.site.origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <ul className={b.board}>
      {posts.map((post, i) => (
        <li key={post.slug}>
          <TicketLink
            href={post.href}
            n={String(i + 1).padStart(2, "0")}
            corner={`${post.readingMinutes} ${labels.minutes}`}
            club={labels.club}
            kind={(post.tags[0] ?? labels.writing).toLocaleUpperCase(locale)}
            title={post.title.toLocaleUpperCase(locale)}
            sub={post.subtitle ?? post.description}
            name={name}
            date={post.displayDate ?? dateOf(post.date, locale)}
            take={labels.readPost}
            url={`${host}${post.href}`}
            pull={labels.pull}
            light={i === 0}
            tilt={TILTS[i % TILTS.length]}
          />
        </li>
      ))}
    </ul>
  );
}

/** Topics as the line's tools row: mono links between slashes. */
export function Tags({ labels, active, all }: { labels: readonly string[]; active?: string; all: string }) {
  if (!labels.length) return null;
  const items = [{ label: all, href: "/blogs", on: !active }, ...labels.map((l) => ({ label: l, href: tagHref(l), on: l === active }))];
  return (
    <nav className={`${s.tools} ${b.tags}`} aria-label={all}>
      {items.map((t, i) => (
        <span key={t.href} className={b.tagItem}>
          {i > 0 && <span className={s.slash} aria-hidden>/</span>}
          <Link href={t.href} className={`${s.tool} ${t.on ? s.toolOn : ""}`} aria-current={t.on ? "page" : undefined}>{t.label}</Link>
        </span>
      ))}
    </nav>
  );
}

export { dateOf, clubLabels };
