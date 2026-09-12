import "server-only";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import routeDefinitions from "./routes.json";

/** Each hand-authored route declares its identity; policy decides publication. */
export function requirePublishedRoute(path: string) {
  const route = routeDefinitions.find((item) => item.path === path);
  if (!route || (route.demoOnly && !siteConfig.features.demoRoutes)) notFound();
}
