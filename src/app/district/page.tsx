import { requirePublishedRoute } from "@/portfolio/route-guard";
import { demoRouteMetadata, districtJsonLd } from "@/demo/seo";
import { DistrictPage } from "@/demo/components/district-page";
import { serializeJsonLd } from "@/lib/json-ld";
import "@/demo/styles/district.css";

export const metadata = demoRouteMetadata.district;

export default function Page() {
  requirePublishedRoute("/district");
  return (
    <>
      <DistrictPage />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(districtJsonLd) }}
      />
    </>
  );
}
