import type { TemplateModule } from "@/core/contracts";
import "./shell.css";

const Layout: TemplateModule["Layout"] = ({ children, slots }) => (
  <>
    {children}
    {slots.footer}
    {slots.floating}
  </>
);
export default Layout;
