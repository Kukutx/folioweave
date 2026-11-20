// Generated from manifest.json by scripts/plugin-contracts.mjs. Do not edit.

export interface LauncherOptions {
  /**
   * Accessible name of the launcher button; defaults to a localised “Tools”.
   */
  label?: string;
  /**
   * Bottom corner the launcher docks to.
   */
  position?: "right" | "left";
  /**
   * Width of the ink drop in CSS pixels.
   */
  size?: number;
  /**
   * Show the pages of enabled plugins.
   */
  pages?: boolean;
  /**
   * Offer a way back to the home page while on another page.
   */
  home?: boolean;
  items?: LauncherItem[];
  /**
   * Bottom spacing in pixels, allowing the launcher to clear existing site controls without moving them.
   */
  offsetBottom?: number;
}
export interface LauncherItem {
  label: string;
  href: string;
  icon?:
    | "link"
    | "home"
    | "article"
    | "image"
    | "mail"
    | "user"
    | "code"
    | "music"
    | "star";
}

export const optionDefaults = {
  position: "right",
  size: 88,
  pages: true,
  home: true,
  items: [],
} satisfies Partial<LauncherOptions>;
