// Generated from manifest.json by scripts/plugin-contracts.mjs. Do not edit.

export type CommentsOptions = {
  provider: "giscus" | "waline";
  serverURL?: string;
  appearance?: "minimal" | "panel";
  accent?: string;
  heading?: string;
  placeholder?: string;
  loading?: "manual" | "viewport";
  login?: "optional" | "disabled";
  pageSize?: number;
  maxLength?: number;
  repo?: string;
  repoId?: string;
  category?: string;
  categoryId?: string;
  theme?: "light" | "dark" | "preferred_color_scheme";
  lang?:
    | "en"
    | "zh-CN"
    | "zh-TW"
    | "it"
    | "fr"
    | "de"
    | "es"
    | "ja"
    | "ko"
    | "pt"
    | "ru";
};

export const optionDefaults = {
  appearance: "minimal",
  login: "disabled",
  pageSize: 6,
  maxLength: 2000,
} satisfies Partial<CommentsOptions>;
