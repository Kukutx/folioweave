import { districtJsonLd, routeMetadata } from "@/config/seo";
import { DistrictPage } from "@/components/district-page";
import { serializeJsonLd } from "@/lib/json-ld";
import "@/styles/district.css";

export const metadata = routeMetadata.district;

export default function Page() {
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
