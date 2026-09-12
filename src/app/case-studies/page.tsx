import { requirePublishedRoute } from "@/portfolio/route-guard";
import { demoRouteMetadata } from "@/demo/seo";
import { CaseStudiesPage } from "@/demo/components/case-studies-page";
import "@/demo/styles/case-studies.css";

export const metadata = demoRouteMetadata.caseStudies;

export default function Page() {
  requirePublishedRoute("/case-studies");
  return <CaseStudiesPage />;
}
