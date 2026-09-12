import { requirePublishedRoute } from "@/portfolio/route-guard";
import { demoRouteMetadata } from "@/demo/seo";
import { BrinkPage } from "@/demo/components/brink-page";
import "@/demo/styles/brink.css";

export const metadata = demoRouteMetadata.brink;
export default function Page() {
  requirePublishedRoute("/brink");
  return <BrinkPage />;
}
