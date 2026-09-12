import { requirePublishedRoute } from "@/portfolio/route-guard";
import { demoRouteMetadata } from "@/demo/seo";
import { CliptPage } from "@/demo/components/clipt-page";
import "@/demo/styles/clipt.css";

export const metadata = demoRouteMetadata.clipt;
export default function Page() {
  requirePublishedRoute("/clipt");
  return <CliptPage />;
}
