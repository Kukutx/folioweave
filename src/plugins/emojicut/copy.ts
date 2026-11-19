/**
 * The page's words in English and Simplified Chinese. Both languages have the
 * same keys (qa/emojicut.test.mjs checks); `vendor` is the AI provider's
 * name and `company` who runs it.
 */

export type Lang = "zh" | "en";

export function langFor(locale: string | undefined): Lang {
  return /^zh\b/i.test(locale ?? "") ? "zh" : "en";
}

/** Inline rich text: plain strings, bold runs and links. */
export type Rich = Array<string | { b: string } | { link: string; href: string }>;

export type Copy = {
  title: string;
  noscript: string;
  modes: string;
  modeCut: string;
  modeAi: string;

  dropSheet: string;
  dropSheetHint: string;
  dropSheetLabel: string;
  chooseImage: string;
  dropCharacter: string;
  dropCharacterHint: string;
  dropCharacterLabel: string;
  removeImage: string;
  styleLabel: string;
  stylePlaceholder: string;
  generate: string;

  keyLabel: (vendor: string) => string;
  keyPlaceholder: string;
  keyGet: (url: string) => Rich;
  keyPrivate: (company: string) => string;
  keySave: string;
  keySaved: (vendor: string) => string;
  keyChange: string;
  keyForget: string;
  cancel: string;

  reading: string;
  designing: string;
  scanning: string;
  cutting: (done: number, total: number) => string;
  naming: (done: number, total: number) => string;

  count: (n: number) => string;
  downloadAll: string;
  addManually: string;
  startOver: string;
  stickers: string;
  download: (name: string) => string;
  rename: (name: string) => string;
  nameLabel: string;

  help: string;
  helpSteps: { cut: Rich; ai: Rich; result: Rich; fix: Rich };
  promptTitle: string;
  promptIntro: string;
  copyPrompt: string;
  copied: string;
  copyFailed: string;
  helperPrompt: string;
  privacyTitle: string;
  privacyCut: string;
  privacyAi: (company: string) => string;
  credit: Rich;
  close: string;

  cropTitle: string;
  cropHint: string;
  cropImage: string;
  cropAdd: string;

  errors: {
    noStickers: string;
    read: string;
    process: string;
    zip: string;
    badKey: string;
    permission: string;
    quota: string;
    safety: string;
    noImage: string;
    model: (model: string) => string;
    network: string;
    server: string;
    generic: string;
  };
  /** The sheet prompt sent to the AI; captions follow the UI language. */
  sheetPrompt: (style?: string) => string;
};

const credit = (lead: string, name: string): Rich => [
  lead,
  { link: name, href: "https://github.com/Rayinf/EmojiCut" },
];

const en: Copy = {
  title: "EmojiCut",
  noscript: "EmojiCut cuts sticker sheets in your browser. Turn on JavaScript to use it.",
  modes: "Mode",
  modeCut: "Cut a sheet",
  modeAi: "Design with AI",

  dropSheet: "Drop a sticker sheet here",
  dropSheetHint: "Or paste one. White backgrounds work best.",
  dropSheetLabel: "Choose a sticker sheet to cut",
  chooseImage: "Choose image",
  dropCharacter: "Drop a character image here",
  dropCharacterHint: "AI designs a sheet of 16 stickers from it.",
  dropCharacterLabel: "Choose a character image",
  removeImage: "Remove image",
  styleLabel: "Style (optional)",
  stylePlaceholder: "e.g. watercolour, pixel art",
  generate: "Generate sheet",

  keyLabel: (vendor) => `${vendor} API key`,
  keyPlaceholder: "Paste your key",
  keyGet: (url) => ["AI design uses your own key. ", { link: "Get a key", href: url }, "."],
  keyPrivate: (company) =>
    `It is kept only in this browser and sent only to ${company}.`,
  keySave: "Save key",
  keySaved: (vendor) => `${vendor} key saved in this browser.`,
  keyChange: "Change key",
  keyForget: "Forget key",
  cancel: "Cancel",

  reading: "Reading the image…",
  designing: "Designing the sheet…",
  scanning: "Finding stickers…",
  cutting: (done, total) => `Cutting ${done} of ${total}`,
  naming: (done, total) => `Naming ${done} of ${total}`,

  count: (n) => (n === 1 ? "1 sticker" : `${n} stickers`),
  downloadAll: "Download all (ZIP)",
  addManually: "Add manually",
  startOver: "Start over",
  stickers: "Stickers",
  download: (name) => `Download ${name}`,
  rename: (name) => `Rename ${name}`,
  nameLabel: "Sticker name",

  help: "How it works",
  helpSteps: {
    cut: ["Drop a sticker sheet on the printer, or paste one."],
    ai: [
      "Or switch to ",
      { b: "Design with AI" },
      " and give it a character: AI draws the sheet and names each sticker.",
    ],
    result: ["Every sticker comes out as a transparent PNG with a white outline."],
    fix: [
      "Download them one by one or all as a ZIP. If one is missed, use ",
      { b: "Add manually" },
      " and drag a box around it.",
    ],
  },
  promptTitle: "Make a sheet yourself",
  promptIntro: "Send this prompt with a character image to Gemini, then cut the result here.",
  copyPrompt: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed. Select the text instead.",
  helperPrompt:
    "Design a cartoon character based on the character in the image and create 16 LINE stickers. Make the poses and text layouts creative, varied and unique. The dialogue should be in English and can show the character in different scenes and emotions, with a two-head-tall body ratio and a pure white background",
  privacyTitle: "Privacy",
  privacyCut: "Cutting happens in this browser. Your images are not uploaded.",
  privacyAi: (company) =>
    `AI design sends the image and your key to ${company} only. The key is kept only in this browser.`,
  credit: credit("Based on ", "EmojiCut by Rayinf"),
  close: "Close",

  cropTitle: "Add a sticker",
  cropHint: "Drag a box around one sticker. With a keyboard, use the arrow keys; Shift resizes.",
  cropImage: "Sticker sheet",
  cropAdd: "Add sticker",

  errors: {
    noStickers: "No stickers found. Use a sheet with a white background.",
    read: "This file could not be read as an image.",
    process: "Something went wrong while cutting. Try again.",
    zip: "The ZIP could not be made. Try again.",
    badKey: "This API key is not valid. Check it and save it again.",
    permission: "This API key may not use this model.",
    quota: "The API quota is used up or there were too many requests. Try again later.",
    safety: "Blocked by safety filters. Try another image or style.",
    noImage: "The model returned no image. Try again.",
    model: (model) => `Model ${model} was not found. Please tell the site owner.`,
    network: "Network error. Check your connection and try again.",
    server: "The AI service is unavailable right now. Try again later.",
    generic: "Generation failed. Try again.",
  },
  sheetPrompt: (style) =>
    `Design a cute cartoon character based on the character in the image and create 16 LINE stickers. Make the poses and text layouts creative, varied and unique. The dialogue should be in English and can show the character in different scenes and emotions, with a two-head-tall body ratio.

Important: the background must be pure white (#FFFFFF), with no other colors or patterns. Leave enough space between stickers.\nArt style: ${style?.trim() || "cute two-head-tall cartoon character, good for everyday chats"}`,
};

const zh: Copy = {
  title: "EmojiCut",
  noscript: "EmojiCut 在浏览器里切贴纸大图，需要开启 JavaScript 才能使用。",
  modes: "模式",
  modeCut: "切图",
  modeAi: "用 AI 设计",

  dropSheet: "把贴纸大图拖到这里",
  dropSheetHint: "也可以直接粘贴。白色背景效果最好。",
  dropSheetLabel: "选择要切的贴纸大图",
  chooseImage: "选择图片",
  dropCharacter: "把角色图片拖到这里",
  dropCharacterHint: "AI 会据此设计一整张 16 个贴纸。",
  dropCharacterLabel: "选择角色图片",
  removeImage: "移除图片",
  styleLabel: "画面风格（可选）",
  stylePlaceholder: "例如：水彩、像素风",
  generate: "生成贴纸",

  keyLabel: (vendor) => `${vendor} API Key`,
  keyPlaceholder: "粘贴你的 Key",
  keyGet: (url) => ["AI 设计使用你自己的 Key。", { link: "获取 Key", href: url }, "。"],
  keyPrivate: (company) => `Key 只保存在这个浏览器里，只发送给 ${company}。`,
  keySave: "保存",
  keySaved: (vendor) => `${vendor} Key 已保存在这个浏览器里。`,
  keyChange: "更换 Key",
  keyForget: "删除 Key",
  cancel: "取消",

  reading: "正在读取图片…",
  designing: "正在设计贴纸…",
  scanning: "正在查找贴纸…",
  cutting: (done, total) => `正在切图 ${done}/${total}`,
  naming: (done, total) => `正在命名 ${done}/${total}`,

  count: (n) => `${n} 张贴纸`,
  downloadAll: "全部下载（ZIP）",
  addManually: "手动添加",
  startOver: "重新开始",
  stickers: "贴纸",
  download: (name) => `下载 ${name}`,
  rename: (name) => `重命名 ${name}`,
  nameLabel: "贴纸名称",

  help: "使用说明",
  helpSteps: {
    cut: ["把贴纸大图拖到打印机上，或直接粘贴。"],
    ai: [
      "也可以切换到",
      { b: "用 AI 设计" },
      "，给它一张角色图片：AI 画出整张贴纸，并给每张命名。",
    ],
    result: ["每张贴纸都会切成带白边的透明 PNG。"],
    fix: [
      "可以逐张下载，也可以打包成 ZIP。漏切了就用",
      { b: "手动添加" },
      "，拖一个框把它框住。",
    ],
  },
  promptTitle: "自己生成大图",
  promptIntro: "把这段提示词和角色图片一起发给 Gemini，再把生成的大图拿来切。",
  copyPrompt: "复制",
  copied: "已复制",
  copyFailed: "复制失败，请手动选中复制。",
  helperPrompt:
    "为图中角色设计一个卡通角色，生成 16种 LINE 贴纸。姿势和文字排版要富有创意，变化丰富，设计独特。对话应为简体中文，可以是角色在不同场景，不同情绪的，角色比例二头身，背景纯白",
  privacyTitle: "隐私",
  privacyCut: "切图在这个浏览器里完成，图片不会上传。",
  privacyAi: (company) =>
    `AI 设计只把图片和你的 Key 发送给 ${company}。Key 只保存在这个浏览器里。`,
  credit: credit("改编自 ", "Rayinf 的 EmojiCut"),
  close: "关闭",

  cropTitle: "手动添加贴纸",
  cropHint: "拖一个框，框住一张贴纸。用键盘时按方向键移动，按住 Shift 调整大小。",
  cropImage: "贴纸大图",
  cropAdd: "添加贴纸",

  errors: {
    noStickers: "没有找到贴纸。请使用白色背景的大图。",
    read: "这个文件无法作为图片读取。",
    process: "切图时出错，请重试。",
    zip: "ZIP 打包失败，请重试。",
    badKey: "API Key 无效，请检查后重新保存。",
    permission: "这个 API Key 没有使用该模型的权限。",
    quota: "API 配额已用完或请求太频繁，请稍后再试。",
    safety: "内容被安全策略拦截，请换一张图片或换个风格再试。",
    noImage: "模型没有返回图片，请重试。",
    model: (model) => `找不到模型 ${model}，请联系站点作者。`,
    network: "网络连接失败，请检查网络后重试。",
    server: "AI 服务暂时不可用，请稍后再试。",
    generic: "生成失败，请重试。",
  },
  sheetPrompt: (style) =>
    `为图中角色设计一个可爱的卡通角色，生成 16种 LINE 贴纸。姿势和文字排版要富有创意，变化丰富，设计独特。对话应为简体中文，可以是角色在不同场景，不同情绪的，角色比例二头身。

重要要求：背景必须是纯白色(#FFFFFF)，不要有任何其他颜色或图案。每个贴纸之间要有足够间距。\n画面风格：${style?.trim() || "可爱的卡通二头身角色，适合日常聊天"}`,
};

export const copies: Record<Lang, Copy> = { en, zh };
