import type { TemplateModule } from "@/core/contracts";
import { Shell, TicketLink, clubLabels } from "./blog";
import b from "./blog.module.css";

/** A ticket that is not on the line: its stub takes you back to it. */
const NotFound: NonNullable<TemplateModule["NotFound"]> = ({ context }) => {
  const L = clubLabels(context);
  const locale = context.site.identity.locale;
  return (
    <Shell context={context} className={b.lost}>
      <TicketLink
        href="/"
        n="404"
        corner={L.pass}
        club={L.club}
        kind={L.notFoundKicker}
        title={`${L.notFoundTop}\n${L.notFoundBottom}`}
        sub={L.notFoundText}
        name={context.site.identity.name.toLocaleUpperCase(locale)}
        date={L.year}
        take={L.backHome}
        url={context.site.origin.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        pull={L.pull}
        tilt={-1.6}
        headingLevel={1}
      />
    </Shell>
  );
};
export default NotFound;
