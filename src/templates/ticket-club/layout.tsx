import type { TemplateModule } from "@/core/contracts";
import { cond, inter, mono } from "./fonts";
import b from "./base.module.css";
import "./host.css";

/** The persistent shell: the original's base styles and faces; each view draws its own red page. */
const Layout: TemplateModule["Layout"] = ({ children, slots }) => (
  <div className={`${b.root} ${mono.variable} ${cond.variable} ${inter.variable}`}>
    {children}
    {slots.footer}
    {slots.floating}
  </div>
);
export default Layout;
