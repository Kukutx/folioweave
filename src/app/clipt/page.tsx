import { routeMetadata } from "@/config/seo";
import { CliptPage } from "@/components/clipt-page";
import "@/styles/clipt.css";

export const metadata = routeMetadata.clipt;
export default function Page() {
  return <CliptPage />;
}
