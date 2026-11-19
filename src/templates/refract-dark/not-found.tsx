import type { TemplateModule } from "@/core/contracts";
import { RefractNotFound } from "@/components/refract/not-found";

const NotFound: NonNullable<TemplateModule["NotFound"]> = (props) => (
  <RefractNotFound {...props} style="dark" />
);
export default NotFound;
