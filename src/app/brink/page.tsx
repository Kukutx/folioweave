import { routeMetadata } from "@/config/seo";
import { BrinkPage } from "@/components/brink-page";
import "@/styles/brink.css";

export const metadata = routeMetadata.brink;
export default function Page() {
  return <BrinkPage />;
}
