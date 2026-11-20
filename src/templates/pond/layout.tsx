import type { TemplateModule } from "@/core/contracts";
import { mono } from "./fonts";
import { restoreThemeScript } from "./theme";
import s from "./pond.module.css";
import "./shell.css";

// The site element holds the palette (dark, or light once the visitor chose it) for every page. The inline
// script restores that choice while the page is parsed; suppressHydrationWarning covers only the data-theme
// attribute it may add to this one element.
const Layout: TemplateModule["Layout"] = ({ children, slots }) => (
  <div className={`${s.site} ${mono.variable}`} data-pond-site="" suppressHydrationWarning>
    <script dangerouslySetInnerHTML={{ __html: restoreThemeScript }} />
    {children}
    {slots.footer}
    {slots.floating}
  </div>
);
export default Layout;
