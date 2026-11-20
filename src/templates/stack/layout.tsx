import type { TemplateModule } from "@/core/contracts";
import { fontVariables } from "./fonts";
import s from "./stack.module.css";
import "./shell.css";

const Layout: TemplateModule["Layout"] = ({ children, slots }) => (
  <div className={`${s.shell} ${fontVariables}`}>
    {children}
    {slots.footer}
    {slots.floating}
  </div>
);
export default Layout;
