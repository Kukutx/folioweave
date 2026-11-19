import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exportableParams } from "@/lib/static-params.mjs";
import { createRouteMetadata } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { templateContext } from "@/core/template-context";
import { templatePages } from "@/portfolio/template-pages.generated";

// Only the selected template's pages exist; publication follows the template.
export const dynamicParams = false;

export function generateStaticParams() {
  return exportableParams(
    templatePages.map((page) => ({ page: page.path })),
    "page",
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page: path } = await params;
  const page = templatePages.find((item) => item.path === path);
  if (!page) return {};
  const { title, description } = page.describe(templateContext);
  return createRouteMetadata({
    title: `${title} | ${siteConfig.identity.name}`,
    description: description ?? title,
    path: page.href,
  });
}

export default async function TemplatePageRoute({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: path } = await params;
  const page = templatePages.find((item) => item.path === path);
  if (!page) notFound();
  const { Page } = page;
  return <Page context={templateContext} />;
}
