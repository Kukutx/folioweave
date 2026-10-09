import type {
  MediaAsset,
  PortfolioConfig as AuthorPortfolio,
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

/** The published profile. An author may omit the blocks only some templates
 * render; publication fills them, so every template reads one complete shape. */
export type PortfolioConfig = AuthorPortfolio &
  Required<Pick<AuthorPortfolio, "photography" | "footerBook" | "interlude">>;
