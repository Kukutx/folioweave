// The personal edition, as a page of its own. In the original, "PERSONAL EDITION ↗" opens it as a layer
// over the line (the page's backdrop and header, a sealed envelope to tear open, the letter inside). Here
// it is the template's `edition` page (/edition, renamed with the editionPath option): the letter is the
// author's own story, so it gets an address, is readable in the server HTML and can be reached without
// JavaScript; the line's page stays light. The same backdrop and header frame it, and the header's ×
// (like the stack's ×, and Escape) goes back to the line.

import { notFound } from "next/navigation";
import type { TemplateContext } from "@/core/contracts";
import { clubLabels, letterOf } from "./data";
import { Backdrop } from "./parts";
import { PageHead } from "./header";
import { EditionView } from "./edition-view";
import { paperFonts } from "./paper-fonts";
import { mono } from "./fonts";
import s from "./ticket-club.module.css";

export function describe(context: TemplateContext) {
  const labels = clubLabels(context);
  const letter = letterOf(context);
  const first = letter?.[0]?.map((r) => r.text).join("").trim();
  return { title: labels.letterTitle, description: first && first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first || undefined };
}

export default function Edition({ context }: { context: TemplateContext }) {
  const letter = letterOf(context);
  if (!letter) notFound();
  const L = clubLabels(context);
  return (
    <main id="main" className={`${s.page} ${mono.className} ${paperFonts}`}>
      <Backdrop />
      <EditionView
        header={<PageHead brandTop={L.brandTop} brandBottom={L.brandBottom} edition={L.edition} editionHref="/" open closeLabel={L.close} home />}
        envelope={{
          to: L.envelopeTo, date: L.envelopeDate, hint: L.envelopeHint, opening: L.envelopeOpening, tag: L.envelopeTag,
          stampLabels: { city: L.stampCity, caption: L.stampCaption, rainy: L.stampRainy, post: L.stampPost, withLove: L.stampWithLove },
        }}
        letter={{ title: L.letterTitle, paragraphs: [[{ text: L.letterGreeting }], ...letter] }}
        stack={{ close: L.close, prev: L.previous, next: L.next }}
      />
    </main>
  );
}
