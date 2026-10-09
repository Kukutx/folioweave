// Generated from manifest.json by scripts/plugin-contracts.mjs. Do not edit.

export type Color = string;

export interface MusicOptions {
  label?: string;
  /**
   * @minItems 1
   */
  tracks: [MusicTrack, ...MusicTrack[]];
  skin?: "capsule" | "square";
  position?: "right" | "bottom";
  theme?: "graphite" | "porcelain" | "cobalt";
  accent?: Color;
  initialExpanded?: boolean;
  /**
   * Bottom spacing in pixels, allowing the plugin to clear existing site controls without moving them.
   */
  offsetBottom?: number;
  volume?: number;
  notes?: {
    enabled?: boolean;
    /**
     * @minItems 3
     * @maxItems 3
     */
    colors?: [Color, Color, Color];
  };
}
export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  src: string;
  cover?: string;
}

export const optionDefaults = {
  skin: "capsule",
  position: "right",
  theme: "graphite",
  initialExpanded: false,
  volume: 0.7,
  notes: { enabled: false, colors: ["#cf8750", "#ac719b", "#528ba6"] },
} satisfies Partial<MusicOptions>;
export const themeAccents = {
  graphite: "#ececf0",
  porcelain: "#333338",
  cobalt: "#d9dfe9",
};
