import type { Metadata } from "next";
import { templateContext } from "@/core/template-context";
import NotFoundView from "@/portfolio/template-not-found.generated";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The requested page could not be found.",
};

export default function NotFound() {
  return <NotFoundView context={templateContext} />;
}
