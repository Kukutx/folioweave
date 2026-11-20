import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { labelsOf, navOf, stockOf } from "./data";
import { fontVariables } from "./fonts";
import { qrPath } from "./qr";
import s from "./site.module.css";
import "./host.css";

/** The stub's code: this site's address, to scan and take along. */
function SiteCode({ text }: { text: string }) {
  const qr = qrPath(text);
  if (!qr) return null;
  return (
    <svg
      className={s.siteCode}
      viewBox={`-1 -1 ${qr.size + 2} ${qr.size + 2}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <path d={qr.d} />
    </svg>
  );
}

/** The persistent shell: the masthead line, the page, and the footer as the page's own stub. */
const Layout: TemplateModule["Layout"] = ({ children, context, slots }) => {
  const { identity, location, copyrightYear } = context.site;
  const labels = labelsOf(context);
  const quote = context.closingQuote;
  return (
    <div className={`${s.root} ${fontVariables}`} data-stock={stockOf(context)}>
      <header className={s.header} id="top">
        <Link href="/" className={s.mark}>
          <span className={s.badge} aria-hidden>
            {identity.initials || identity.name.slice(0, 2)}
          </span>
          <span className={s.markName}>{identity.name}</span>
        </Link>
        <nav className={s.nav}>
          <ul>
            {navOf(context).map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {children}
      <footer className={s.stub}>
        <div className={s.stubInner}>
          {quote.quote.trim() && (
            <blockquote className={s.quote}>
              <p>“{quote.quote.trim()}”</p>
              {quote.author.trim() && <cite>— {quote.author.trim()}</cite>}
            </blockquote>
          )}
          <div>
            <p className={s.stubName}>{identity.name}</p>
            <p className={`${s.mono} ${s.stubLine}`}>
              <span>© {copyrightYear}</span>
              {location.city && <span>{location.city}</span>}
              <span className={s.serialMark}>{labels.stub}</span>
            </p>
          </div>
          <div className={s.keep}>
            <SiteCode text={context.site.origin} />
            <a className={`${s.mono} ${s.top}`} href="#top">
              <span>{labels.top}</span>
              <span aria-hidden>↑</span>
            </a>
          </div>
          <div className={s.slot}>{slots.footer}</div>
        </div>
      </footer>
      {slots.floating}
    </div>
  );
};
export default Layout;
