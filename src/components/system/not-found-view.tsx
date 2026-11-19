import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import "@/styles/theme.css";
import "@/styles/system-state.css";

/** The core's 404 page, used by templates that do not bring their own. */
const NotFoundView: NonNullable<TemplateModule["NotFound"]> = () => (
  <main className="system-state-page">
    <section className="system-state-card" aria-labelledby="not-found-title">
      <span className="system-state-code" aria-hidden>
        404
      </span>
      <h1 id="not-found-title" className="system-state-title">
        This page wandered off.
      </h1>
      <p className="system-state-copy">
        The link may be outdated, or the page may have moved somewhere else.
      </p>
      <div className="system-state-actions">
        <Link className="system-state-action" href="/">
          Back home
        </Link>
        <Link
          className="system-state-action system-state-action-secondary"
          href="/#work"
        >
          View work
        </Link>
      </div>
    </section>
  </main>
);
export default NotFoundView;
