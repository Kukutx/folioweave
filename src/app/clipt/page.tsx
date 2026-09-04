import { requireDemoRoutes } from "@/portfolio/demo-routes";
import { routeMetadata } from "@/config/seo";
import { CliptPage } from "@/components/clipt-page";
import "@/styles/clipt.css";

export const metadata = routeMetadata.clipt;
export default function Page() {
  requireDemoRoutes();
  return <CliptPage />;
}
