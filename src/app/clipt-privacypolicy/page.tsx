import { requirePublishedRoute } from "@/portfolio/route-guard";
import { demoRouteMetadata } from "@/demo/seo";
import { CliptPrivacyPage } from "@/demo/components/clipt-privacy-page";
import "@/demo/styles/privacy.css";

export const metadata = demoRouteMetadata.cliptPrivacy;

export default function Page() {
  requirePublishedRoute("/clipt-privacypolicy");
  return <CliptPrivacyPage />;
}
