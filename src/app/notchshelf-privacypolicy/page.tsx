import { requirePublishedRoute } from "@/portfolio/route-guard";
import { products } from "@/config/products";
import { routeMetadata } from "@/config/seo";
import { AnalyticsPrivacy } from "@/components/analytics-privacy";
import "@/styles/privacy.css";

export const metadata = routeMetadata.notchShelfPrivacy;
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
