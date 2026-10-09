import type { TemplateModule } from "@/core/contracts";
import { RefractHome } from "@/components/refract/home";

const Home: TemplateModule["Home"] = (props) => (
  <RefractHome {...props} style="light" />
);
export default Home;
