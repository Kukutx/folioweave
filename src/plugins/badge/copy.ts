const copy = {
  en: {
    open: "Open badge",
    close: "Close badge",
    hint: "Drag, throw or tap to flip",
    hintStill: "Tap to flip",
    dialog: "Badge",
    cards: "Badge",
    flip: "Press Enter to flip",
  },
  zh: {
    open: "打开工牌",
    close: "关闭工牌",
    hint: "拖动、甩动，点一下翻面",
    hintStill: "点一下翻面",
    dialog: "工牌",
    cards: "工牌",
    flip: "按回车键翻面",
  },
};

export type BadgeCopy = (typeof copy)["en"];

/** Wording for the visitor's locale; options may replace the main strings. */
export function badgeCopy(
  locale: string,
  overrides: Partial<Pick<BadgeCopy, "open" | "close" | "hint">> = {},
): BadgeCopy {
  const base = locale.toLowerCase().startsWith("zh") ? copy.zh : copy.en;
  return { ...base, ...overrides };
}
