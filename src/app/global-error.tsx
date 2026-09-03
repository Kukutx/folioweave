"use client";

import Link from "next/link";
import { siteConfig } from "@/config/site";
import "./globals.css";
import "@/styles/theme.css";
import "@/styles/system-state.css";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang={siteConfig.identity.locale}>
      <body>
        <title>Something went wrong</title>
        <main className="system-state-page">
          <section className="system-state-card" aria-labelledby="global-error-title">
            <span className="system-state-code" aria-hidden>
              !
            </span>
            <h1 id="global-error-title" className="system-state-title">
              The site needs another try.
            </h1>
            <p className="system-state-copy">
              A top-level error interrupted the page. Retry to rebuild the app
              shell without losing the current URL.
            </p>
            <div className="system-state-actions">
              <button
                className="system-state-action"
                type="button"
                onClick={retry}
              >
                Try again
              </button>
              <Link
                className="system-state-action system-state-action-secondary"
                href="/"
              >
                Back home
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
