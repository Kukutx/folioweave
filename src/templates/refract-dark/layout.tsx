import type { TemplateModule } from "@/core/contracts";
import { RefractLayout } from "@/components/refract/layout";

const Layout: TemplateModule["Layout"] = (props) => (
  <RefractLayout {...props} style="dark" />
);
export default Layout;
