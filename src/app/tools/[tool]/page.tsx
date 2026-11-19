import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exportableParams } from "@/lib/static-params.mjs";
import { createRouteMetadata } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { PluginBoundary } from "@/core/plugin-boundary";
import { pluginPages } from "@/portfolio/plugin-pages.generated";

// Only pages of enabled plugins exist; publication follows the plugin selection.
export const dynamicParams = false;

export function generateStaticParams() {
  return exportableParams(
    pluginPages.map((page) => ({ tool: page.path })),
    "tool",
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;
  const page = pluginPages.find((item) => item.path === tool);
  if (!page) return {};
  return createRouteMetadata({
    title: `${page.title} | ${siteConfig.identity.name}`,
    description: page.description ?? page.title,
    path: page.href,
  });
}

export default async function PluginPageRoute({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  const page = pluginPages.find((item) => item.path === tool);
  if (!page) notFound();
  const { Page } = page;
  return (
    <PluginBoundary key={page.id} name={page.name}>
      <Page
        options={page.options}
        context={{ locale: siteConfig.identity.locale }}
      />
    </PluginBoundary>
  );
}
