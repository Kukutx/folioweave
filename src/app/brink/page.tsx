import { requirePublishedRoute } from "@/portfolio/route-guard";
import { routeMetadata } from "@/config/seo";
import { BrinkPage } from "@/components/brink-page";
import "@/styles/brink.css";

export const metadata = routeMetadata.brink;
export default function Page() {
  requirePublishedRoute("/brink");
  return <BrinkPage />;
}
