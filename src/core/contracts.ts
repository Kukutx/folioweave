import type { ComponentType, ReactNode } from "react";
import type { BlogPostSummary, MarkdownBlogPost } from "@/blog/types";
import type { PortfolioConfig } from "@/portfolio/schema";
import type points from "./extension-points.json";

export type PluginSlotName = keyof typeof points.slots;
export type PluginContext = {
  locale: string;
  article?: { id: string; title: string; href: string };
};
export type PluginSlotProps = { name: PluginSlotName; context: PluginContext };
export type PluginProps<Options> = { options: Options; context: PluginContext };

/** Content is independent of a template's DOM, navigation geometry and effects. */
export type TemplateContext = {
  site: PortfolioConfig["site"];
  introduction: PortfolioConfig["hero"];
  biography: PortfolioConfig["about"];
  projects: PortfolioConfig["projects"];
  photography: PortfolioConfig["photography"];
  writing: PortfolioConfig["blog"];
  features: PortfolioConfig["features"];
  options: Readonly<Record<string, unknown>>;
  capabilities: { writing: boolean };
};
export type BlogTagView = {
  label: string;
  posts: BlogPostSummary[];
  labels: string[];
};
export type TemplateModule = {
  Layout: ComponentType<{
    children: ReactNode;
    context: TemplateContext;
    slots: { footer: ReactNode; floating: ReactNode };
  }>;
  Home: ComponentType<{ context: TemplateContext }>;
  BlogIndex: ComponentType<{
    posts: BlogPostSummary[];
    context: TemplateContext;
  }>;
  BlogPost: ComponentType<{
    post: MarkdownBlogPost;
    afterArticle: ReactNode;
    context: TemplateContext;
  }>;
  BlogTag: ComponentType<{ tag: BlogTagView; context: TemplateContext }>;
};
