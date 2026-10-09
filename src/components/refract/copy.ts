/** Interface wording for Refract's home and writing views. Content always comes
 * from the author's profile; these are only the labels around it. */
const en = {
  about: "About",
  news: "News",
  cv: "CV",
  contact: "Contact",
  writing: "Writing",
  home: "Home",
  overview: "Overview",
  projects: "Projects",
  tools: "Tools",
  transition: "Transition",
  getInTouch: "Get in touch",
  learnMore: "Learn more",
  viewProject: "View project",
  viewFigure: "View full figure",
  position: "Position",
  group: "Group",
  focus: "Focus",
  publications: "Selected publications",
  basedIn: "Based in",
  skipToContent: "Skip to content",
  pauseAnimation: "Pause animation",
  resumeAnimation: "Resume animation",
  backToHome: "Back to Home",
  openNavigation: "Open navigation",
  closeNavigation: "Close navigation",
  mainNavigation: "Main navigation",
  pageChapters: "Page chapters",
  writingEyebrow: "Notes & perspectives",
  allWriting: "All writing",
  allTopics: "All",
  articleTopics: "Article topics",
  noArticles: "No articles yet.",
  minRead: "min read",
  onThisPage: "On this page",
  articleOutline: "Article outline",
  articleNavigation: "Article navigation",
  backToTop: "Back to top",
};
export type RefractCopy = typeof en;

const zh: RefractCopy = {
  about: "关于",
  news: "动态",
  cv: "履历",
  contact: "联系",
  writing: "文章",
  home: "首页",
  overview: "概览",
  projects: "项目",
  tools: "工具",
  transition: "过渡",
  getInTouch: "联系我",
  learnMore: "了解更多",
  viewProject: "查看项目",
  viewFigure: "查看原图",
  position: "职位",
  group: "团队",
  focus: "方向",
  publications: "代表论文",
  basedIn: "现居",
  skipToContent: "跳到正文",
  pauseAnimation: "暂停动画",
  resumeAnimation: "继续动画",
  backToHome: "回到首页",
  openNavigation: "打开导航",
  closeNavigation: "关闭导航",
  mainNavigation: "主导航",
  pageChapters: "页面章节",
  writingEyebrow: "笔记与思考",
  allWriting: "全部文章",
  allTopics: "全部",
  articleTopics: "文章主题",
  noArticles: "暂无文章。",
  minRead: "分钟阅读",
  onThisPage: "本页目录",
  articleOutline: "文章目录",
  articleNavigation: "文章导航",
  backToTop: "回到顶部",
};

const dictionaries: Record<string, RefractCopy> = { en, zh };
export const refractCopyKeys = Object.keys(en) as (keyof RefractCopy)[];

/** The profile's language picks the wording; the template's `labels` option
 * replaces individual entries, in any language. */
export function refractCopy(
  locale: string,
  overrides: Partial<RefractCopy> = {},
): RefractCopy {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return { ...(dictionaries[language] ?? en), ...overrides };
}
