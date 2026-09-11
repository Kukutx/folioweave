import type {
  MediaAsset,
  PortfolioConfig,
  Project,
  ProjectAction,
  ProjectBadge,
  ProjectCarouselImage,
  ProjectImage,
  ProjectMedia,
  ProjectStory,
  RichTextSegment,
} from "./schema.generated";

export type PortfolioSocialIcon =
  PortfolioConfig["site"]["socialLinks"][number]["icon"];
export type PortfolioRichTextSegment = RichTextSegment;
export type PortfolioStorySegment =
  PortfolioConfig["about"]["story"][number][number];
export type PortfolioMediaAsset = MediaAsset;
export type PortfolioProject = Project;
export type PortfolioProjectAction = ProjectAction;
export type PortfolioProjectBadge = ProjectBadge;
export type PortfolioProjectCarouselImage = ProjectCarouselImage;
export type PortfolioProjectImage = ProjectImage;
export type PortfolioProjectMedia = ProjectMedia;
export type PortfolioProjectStory = ProjectStory;

export type { PortfolioConfig } from "./schema.generated";
