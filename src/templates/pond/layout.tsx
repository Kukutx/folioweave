import type { TemplateModule } from "@/core/contracts";
import { defaultScheme, pondLabels } from "./data";
import { fontVariables } from "./fonts";
import { restoreThemeScript } from "./theme";
import s from "./pond.module.css";
import "./host.css";

// The site element holds the palette and the fonts for every page. The inline script restores the visitor's time of
// day while the page is parsed; suppressHydrationWarning covers only the data-theme attribute it may add here.
const Layout: TemplateModule["Layout"] = ({ children, context, slots }) => (
  <div
    className={`${s.site} ${fontVariables}`}
    data-pond-site=""
    data-default={defaultScheme(context)}
    suppressHydrationWarning
  >
    <script dangerouslySetInnerHTML={{ __html: restoreThemeScript }} />
    <a className={s.skip} href="#main">
      {pondLabels(context).skip}
    </a>
    {children}
    {slots.footer}
    {slots.floating}
  </div>
);
export default Layout;
