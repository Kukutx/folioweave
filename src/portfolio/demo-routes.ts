import { notFound } from "next/navigation";
import { portfolio } from "@/portfolio";

export function requireDemoRoutes() {
  if (!portfolio.features.demoRoutes) notFound();
}
