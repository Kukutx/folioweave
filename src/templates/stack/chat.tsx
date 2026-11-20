"use client";

// The contact conversation: copy the e-mail, fill the form (it opens the visitor's mail app with the
// message ready to send to the same inbox), follow the links.

import { useEffect, useRef, useState, type ReactElement } from "react";
import type { Bubble, SocialIcon, StackLabels } from "./data";
import * as I from "./icons";
import s from "./stack.module.css";

function EmailCard({ text, email, label }: { text: string; email: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // clipboard blocked (permissions / insecure context): fall back to a selection copy
      const ta = document.createElement("textarea");
      ta.value = email;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    setCopied(true);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className={s.card}>
      <p>
        <a href={`mailto:${email}`} className={s.mailLink}>
          {text}
        </a>
      </p>
      <button type="button" className={s.action} onClick={copy} data-done={copied}>
        <span className={s.swap}>
          <I.Copy className={s.iconA} />
          <I.Check className={s.iconB} />
        </span>
        {label}
      </button>
      <span className={s.srOnly} aria-live="polite">
        {copied ? email : ""}
      </span>
    </div>
  );
}

function FormCard({ text, to, labels }: { text: string; to: string; labels: StackLabels }) {
  const [sent, setSent] = useState(false);
  return (
    <div className={s.card}>
      <p>{text}</p>
      <form
        className={s.form}
        action={`mailto:${to}`}
        method="post"
        encType="text/plain"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const name = String(f.get("name") || "").trim();
          const from = String(f.get("email") || "").trim();
          const msg = String(f.get("message") || "").trim();
          // the message lands in the same inbox: hand it to the visitor's mail app, ready to send
          window.location.href = `mailto:${to}?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(
            `${msg}\n\n${name} <${from}>`,
          )}`;
          setSent(true);
        }}
      >
        <input
          name="name"
          placeholder={labels.namePlaceholder}
          aria-label={labels.namePlaceholder}
          required
          autoComplete="name"
        />
        <input
          name="email"
          type="email"
          placeholder={labels.emailPlaceholder}
          aria-label={labels.emailPlaceholder}
          required
          autoComplete="email"
        />
        <textarea
          name="message"
          placeholder={labels.messagePlaceholder}
          aria-label={labels.messagePlaceholder}
          maxLength={300}
          required
        />
        <button type="submit" className={s.action} data-done={sent}>
          <span className={s.swap} data-solo="true">
            <I.Check className={s.iconB} />
          </span>
          {labels.submit}
        </button>
      </form>
    </div>
  );
}

const GLYPH: Record<SocialIcon, (p: { className?: string }) => ReactElement> = {
  twitter: I.XLogo,
  linkedin: I.LinkedIn,
  instagram: I.Instagram,
  github: I.GitHub,
  website: I.Globe,
  email: I.Mail,
};

function LinksCard({ b }: { b: Extract<Bubble, { card: "links" }> }) {
  return (
    <div className={s.card}>
      <p>{b.text}</p>
      {b.links.map((l) => {
        const Glyph = GLYPH[l.icon] ?? I.Globe;
        return (
          <a key={l.href} className={s.action} href={l.href} target="_blank" rel="noreferrer">
            <Glyph />
            {l.label}
          </a>
        );
      })}
    </div>
  );
}

export function Chat({ chat, email, labels }: { chat: Bubble[][]; email: string; labels: StackLabels }) {
  return (
    <section id="contact" className={s.chat} aria-label={labels.contact}>
      {chat.map((group, gi) => (
        <div key={gi} className={s.group} data-me={group[0].from === "me"}>
          {group.map((b, bi) => (
            <div key={bi} className={b.from === "me" ? s.me : s.them}>
              {!("card" in b) ? (
                <span>{b.text}</span>
              ) : b.card === "email" ? (
                <EmailCard text={b.text} email={b.email} label={labels.copy} />
              ) : b.card === "form" ? (
                <FormCard text={b.text} to={email} labels={labels} />
              ) : (
                <LinksCard b={b} />
              )}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
