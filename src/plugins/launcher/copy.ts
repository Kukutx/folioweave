const copy = {
  en: {
    label: "Tools",
    open: "Open %s",
    close: "Close %s",
    home: "Home",
    external: "opens in a new tab",
  },
  zh: {
    label: "工具",
    open: "打开%s",
    close: "关闭%s",
    home: "首页",
    external: "在新标签页打开",
  },
} as const;

export type LauncherCopy = (typeof copy)[keyof typeof copy];

export function launcherCopy(locale: string): LauncherCopy {
  return locale.toLowerCase().startsWith("zh") ? copy.zh : copy.en;
}
