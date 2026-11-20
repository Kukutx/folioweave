import Link from "next/link";
import type { CSSProperties } from "react";
import type { TemplateModule } from "@/core/contracts";
import { fill, labelsOf } from "./data";
import { TicketFace } from "./ticket";
import s from "./site.module.css";
import t from "./strip.module.css";
import g from "./pages.module.css";

/** A ticket for a page that is not on the programme: stamped void, its stub long gone. */
const NotFound: NonNullable<TemplateModule["NotFound"]> = ({ context }) => {
  const labels = labelsOf(context);
  return (
    <main id="main" className={s.main}>
      <section className={g.lost}>
        <div
          className={`${t.strip} ${t.single}`}
          style={{ "--stub-w": "0px" } as CSSProperties}
        >
          <div className={t.ticket} data-torn="">
            <div className={t.paper}>
              <div className={t.body}>
                <TicketFace
                  as="h1"
                  serial="000404"
                  kicker={labels.notFoundKicker}
                  title={[labels.notFoundTop, labels.notFoundBottom]}
                  address={labels.notFoundText}
                  issuedBy={fill(labels.issuedBy, {
                    name: context.site.identity.name,
                  })}
                  arrow={false}
                />
              </div>
            </div>
            <span className={`${t.stamp} ${g.void}`} aria-hidden>
              {labels.void}
            </span>
          </div>
        </div>
        <Link href="/" className={`${s.mono} ${s.more} ${g.home}`}>
          <span aria-hidden>←</span> {labels.backHome}
        </Link>
      </section>
    </main>
  );
};
export default NotFound;
