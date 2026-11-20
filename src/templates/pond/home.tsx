import type { TemplateModule } from "@/core/contracts";
import { buildPond } from "./data";
import { PondHome } from "./pond-home";

const Home: TemplateModule["Home"] = ({ context }) => <PondHome data={buildPond(context)} />;
export default Home;
