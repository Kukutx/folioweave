import "server-only";
import { portfolio } from "@/portfolio";
import { templateOptions } from "@/portfolio/template.generated";
import type { TemplateContext } from "./contracts";
import { getBlogIndexPosts } from "@/blog";

export const templateContext: TemplateContext = {
  site: portfolio.site,
  introduction: portfolio.hero,
  biography: portfolio.about,
  projects: portfolio.projects,
  photography: portfolio.photography,
  writing: portfolio.blog,
  features: portfolio.features,
  options: templateOptions,
  capabilities: { writing: getBlogIndexPosts().length > 0 },
};
