// Ticket Club: the codes printed on the stubs and how a profile becomes tickets and a letter.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { qrModules } from "../src/templates/ticket-club/qr.ts";
import {
  articleTicket,
  copyText,
  labelsOf,
  letterOf,
  shortLink,
  ticketsOf,
  twoLines,
} from "../src/templates/ticket-club/data.ts";

const digest = (m) =>
  createHash("sha256")
    .update(m.map((row) => row.map((c) => (c ? 1 : 0)).join("")).join("\n"))
    .digest("hex")
    .slice(0, 16);

// Each of these was read back by a QR decoder when it was recorded.
test("stub codes stay the codes a scanner reads", () => {
  const long = `https://example.com/${"b".repeat(175)}`;
  for (const [text, size, hash] of [
    ["mailto:hello@example.com", 25, "3cc78558e23a87e8"],
    ["https://example.com/#twitter", 29, "fcc3af31fd4d5a45"],
    [long, 57, "2112d0e19b534a62"],
  ]) {
    const m = qrModules(text);
    assert.equal(m.length, size, text);
    assert.equal(digest(m), hash, text);
  }
});

test("a link too long for a whole code gets none, never a shortened one", () => {
  assert.equal(qrModules(`https://example.com/${"x".repeat(200)}`), null);
  assert.ok(qrModules(`https://example.com/${"x".repeat(193)}`));
});

test("the format information says error correction M and a valid mask", () => {
  const m = qrModules("https://example.com/");
  let bits = 0;
  for (let i = 0; i <= 5; i++) bits |= (m[i][8] ? 1 : 0) << i;
  bits |= (m[7][8] ? 1 : 0) << 6;
  bits |= (m[8][8] ? 1 : 0) << 7;
  bits |= (m[8][7] ? 1 : 0) << 8;
  for (let i = 9; i < 15; i++) bits |= (m[8][14 - i] ? 1 : 0) << i;
  const data = (bits ^ 0x5412) >>> 10;
  assert.equal(data >>> 3, 0, "level M");
  let r = data;
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  assert.equal(((data << 10) | r) ^ 0x5412, bits, "BCH check");
});

const context = (over = {}) => ({
  site: {
    identity: { name: "Ada Example", initials: "AE", locale: "en-US" },
    origin: "https://example.com",
    copyrightYear: 2026,
    contact: { email: "hello@example.com" },
    socialLinks: [
      { label: "Website", icon: "website", href: "https://example.com/" },
      { label: "GitHub", icon: "github", href: "https://github.com/example" },
      { label: "Email", icon: "email", href: "mailto:hello@example.com" },
    ],
    location: { city: "Turin", country: "Italy" },
  },
  introduction: { portraits: ["/p.jpg"], roleLine: [], summary: [] },
  biography: {
    story: [
      [
        { tone: "strong", text: "First." },
        { tone: "muted", text: "  " },
      ],
      [],
    ],
  },
  projects: [],
  writing: { title: "Notes" },
  features: { about: true, work: true },
  capabilities: { writing: true },
  options: {},
  ...over,
});

test("without a list the roll holds the profile's links, never this site", () => {
  const tickets = ticketsOf(context());
  assert.deepEqual(
    tickets.map((t) => t.label),
    ["GitHub", "Email"],
  );
  assert.equal(tickets[0].external, true);
  assert.equal(tickets[1].link, "mailto:hello@example.com");
  assert.equal(tickets[1].address, "hello@example.com");
  assert.match(tickets[0].serial, /^\d{6}$/);
  assert.equal(tickets[0].serial, ticketsOf(context())[0].serial);
});

test("the e-mail address joins the roll when no link carries it", () => {
  const c = context();
  c.site.socialLinks = c.site.socialLinks.filter((l) => l.icon !== "email");
  assert.deepEqual(
    ticketsOf(c).map((t) => t.link),
    ["https://github.com/example", "mailto:hello@example.com"],
  );
});

test("the tickets option wins, at most six, paths made absolute", () => {
  const list = Array.from({ length: 6 }, (_, i) => ({ link: `/p${i}` }));
  const tickets = ticketsOf(
    context({
      options: {
        tickets: [
          { link: "/now", title: ["Now", "on"], stub: "Keep" },
          ...list.slice(1),
        ],
      },
    }),
  );
  assert.equal(tickets.length, 6);
  assert.equal(tickets[0].link, "https://example.com/now");
  assert.deepEqual(tickets[0].title, ["Now", "on"]);
  assert.equal(tickets[0].stub, "Keep");
  assert.equal(tickets[0].external, false);
});

test("labels, letter and article ticket come from the profile and the settings", () => {
  const labels = labelsOf(
    context({ options: { labels: { letter: "Lettera" } } }),
  );
  assert.equal(labels.letter, "Lettera");
  assert.equal(labels.writing, "Notes");
  assert.equal(labels.envelopeDate, "Turin, 2026");
  const letter = letterOf(context());
  assert.deepEqual(letter.paragraphs, [[{ text: "First.", tone: "strong" }]]);
  assert.equal(letter.from, "From Ada Example");
  assert.equal(letter.stamp.portrait, "/p.jpg");
  assert.equal(letterOf(context({ features: { about: false } })), null);
  const ticket = articleTicket(context(), {
    title: "A rather long article title",
    href: "/blogs/long",
  });
  assert.equal(ticket.link, "https://example.com/blogs/long");
  assert.equal(ticket.title.length, 2);
});

test("links are printed short and copied whole", () => {
  assert.equal(shortLink("https://www.example.com/a/"), "example.com/a");
  assert.equal(copyText("mailto:hi@example.com?subject=Hi"), "hi@example.com");
  assert.equal(copyText("https://example.com/a"), "https://example.com/a");
  assert.deepEqual(twoLines("Short"), ["Short"]);
});
