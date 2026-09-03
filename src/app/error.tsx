"use client";

import Link from "next/link";
import "@/styles/theme.css";
import "@/styles/system-state.css";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="system-state-page">
      <section className="system-state-card" aria-labelledby="error-title">
        <span className="system-state-code" aria-hidden>
          !
        </span>
        <h1 id="error-title" className="system-state-title">
          Something went wrong.
        </h1>
        <p className="system-state-copy">
          The page hit an unexpected problem. You can retry this section or
          return to the homepage.
        </p>
        <div className="system-state-actions">
          <button className="system-state-action" type="button" onClick={retry}>
            Try again
          </button>
          <Link className="system-state-action system-state-action-secondary" href="/">
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}
