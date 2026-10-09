import { requirePublishedRoute } from "@/portfolio/route-guard";
import { demoRouteMetadata } from "@/demo/seo";
import { FlipFactPrivacyPage } from "@/demo/components/flipfact-privacy-page";
import "@/demo/styles/flipfact.css";

export const metadata = demoRouteMetadata.flipfactPrivacy;

export default function Page() {
  requirePublishedRoute("/flipfact");
  return <FlipFactPrivacyPage />;
}
