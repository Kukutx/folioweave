import { requirePublishedRoute } from "@/portfolio/route-guard";
import { products } from "@/demo/products";
import { demoRouteMetadata } from "@/demo/seo";
import { AnalyticsPrivacy } from "@/demo/components/analytics-privacy";
import "@/demo/styles/privacy.css";

export const metadata = demoRouteMetadata.notchShelfPrivacy;
export default function Page() {
  requirePublishedRoute("/notchshelf-privacypolicy");
  return (
    <AnalyticsPrivacy
      product="NotchShelf"
      prefix="notchshelf"
      email={products.notchShelf.supportEmail}
    />
  );
}
