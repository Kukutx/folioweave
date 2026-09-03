import type { ReactNode } from "react";
import { PrivacyDateLine } from "./privacy-date-line";

export type PrivacyPrefix = "clipt" | "habee" | "notchshelf";

export function privacyClass(prefix: PrivacyPrefix, slot: string) {
  return `privacy-${slot} ${prefix}-privacy-${slot}`;
}

export function PrivacyPageShell({
  prefix,
  subtitle,
  children,
}: {
  prefix: PrivacyPrefix;
  subtitle: string;
  children: ReactNode;
}) {
  const initialDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className={privacyClass(prefix, "page")}>
      <div className={privacyClass(prefix, "container")}>
        <header className={privacyClass(prefix, "header")}>
          <h1 className={privacyClass(prefix, "title")}>Privacy Policy</h1>
          <p className={privacyClass(prefix, "subtitle")}>{subtitle}</p>
          <PrivacyDateLine
            className={privacyClass(prefix, "date")}
            initialDate={initialDate}
          />
        </header>
        <div className={privacyClass(prefix, "content")}>{children}</div>
      </div>
    </div>
  );
}

export function PrivacySection({
  prefix,
  title,
  children,
}: {
  prefix: PrivacyPrefix;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={privacyClass(prefix, "section")}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
