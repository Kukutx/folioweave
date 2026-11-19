import type { ComponentType, ReactNode } from "react";
import type { BlogPostSummary, MarkdownBlogPost } from "@/blog/types";
import type { PortfolioConfig } from "@/portfolio/schema";
import type points from "./extension-points.json";

export type PluginSlotName = keyof typeof points.slots;
/** A page or an action an enabled plugin contributes, as menus show it. An
 * action's href is `#<hash>`: the plugin opens in place on that hash. */
export type PluginPageLink = {
  id: string;
  kind: "page" | "action";
  path: string;
  href: string;
  title: string;
  description?: string;
  /** Rendered on the server from the plugin's icon component. */
  icon?: ReactNode;
};
export type PluginContext = {
  locale: string;
  article?: { id: string; title: string; href: string };
  /** Pages of enabled plugins; site-wide slots receive them for navigation. */
  pages?: PluginPageLink[];
};
export type PluginSlotProps = { name: PluginSlotName; context: PluginContext };
export type PluginProps<Options> = { options: Options; context: PluginContext };
/** A plugin page fills the content area under the template's layout. */
export type PluginPageProps<Options> = PluginProps<Options>;
export type PluginPageEntry = Omit<PluginPageLink, "icon" | "kind"> & {
  name: string;
  // Options are validated against the manifest before generation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Page: ComponentType<PluginPageProps<any>>;
  options: Readonly<Record<string, unknown>>;
};

/** The store block as templates read it; without one, there are no locations. */
export type StoreView = NonNullable<PortfolioConfig["store"]>;

/** Content is independent of a template's DOM, navigation geometry and effects. */
export type TemplateContext = {
  site: PortfolioConfig["site"];
  introduction: PortfolioConfig["hero"];
  biography: PortfolioConfig["about"];
  projects: PortfolioConfig["projects"];
  photography: PortfolioConfig["photography"];
  writing: PortfolioConfig["blog"];
  features: PortfolioConfig["features"];
  /** Shop data; templates that render it require it, others see no locations. */
  store: StoreView;
  /** A closing quote; empty strings when the author has none. */
  closingQuote: PortfolioConfig["footerBook"];
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
  /** Optional; the core's own 404 page is used when a template has none. */
  NotFound?: ComponentType<{ context: TemplateContext }>;
};
/** A page module a template adds under `pages` in its manifest. */
export type TemplatePageModule = {
  default: ComponentType<{ context: TemplateContext }>;
  describe: (context: TemplateContext) => { title: string; description?: string };
};
export type TemplatePageEntry = {
  id: string;
  path: string;
  href: string;
  Page: TemplatePageModule["default"];
  describe: TemplatePageModule["describe"];
};
