import { requireDemoRoutes } from "@/portfolio/demo-routes";
import { products } from "@/config/products";
import { routeMetadata } from "@/config/seo";
import { AnalyticsPrivacy } from "@/components/analytics-privacy";
import "@/styles/privacy.css";

export const metadata = routeMetadata.habeePrivacy;
export default function Page() {
  requireDemoRoutes();
  return (
    <AnalyticsPrivacy
      product="Habee"
      prefix="habee"
      email={products.habee.supportEmail}
    />
  );
}
