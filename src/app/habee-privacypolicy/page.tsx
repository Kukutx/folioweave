import { requirePublishedRoute } from "@/portfolio/route-guard";
import { products } from "@/demo/products";
import { demoRouteMetadata } from "@/demo/seo";
import { AnalyticsPrivacy } from "@/demo/components/analytics-privacy";
import "@/demo/styles/privacy.css";

export const metadata = demoRouteMetadata.habeePrivacy;
export default function Page() {
  requirePublishedRoute("/habee-privacypolicy");
  return (
    <AnalyticsPrivacy
      product="Habee"
      prefix="habee"
      email={products.habee.supportEmail}
    />
  );
}
