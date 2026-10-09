import { requirePublishedRoute } from "@/portfolio/route-guard";
import { demoRouteMetadata } from "@/demo/seo";
import { BrinkPrivacyPage } from "@/demo/components/brink-privacy-page";
import "@/demo/styles/brink-privacy.css";

export const metadata = demoRouteMetadata.brinkPrivacy;

export default function Page() {
  requirePublishedRoute("/brink/privacy");
  return <BrinkPrivacyPage />;
}
