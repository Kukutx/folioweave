import type { TemplateModule } from "@/core/contracts";
import { buildClub } from "./data";
import { TicketClub } from "./club";

const Home: TemplateModule["Home"] = ({ context }) => (
  <main id="main">
    <TicketClub data={buildClub(context)} />
  </main>
);
export default Home;
