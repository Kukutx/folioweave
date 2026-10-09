import { mix, smooth } from "./motion";

const surfaces = {
  dark: [37, 36, 35],
  drawing: [218, 213, 208],
  black: [8, 8, 8],
  white: [255, 255, 255],
} as const;
const rgb = (channels: readonly number[]) => `rgb(${channels.join(" ")})`;
const toolsDrawing = (progress: number) =>
  smooth(0.82, 0.84, progress) * (1 - smooth(0.94, 0.96, progress));

// Measured from animejs.com: the dark stage, warm technical drawing and accents.
export const sceneColors = {
  dark: surfaces.dark,
  light: surfaces.drawing,
  foreground: "#f6f4f2",
  muted: "#cccac8",
  panel: "#302e2d",
  accents: ["#ff4b4b", "#ffa828", "#00ffaa", "#05dbe9"],
  cursorPreview: "#d44343",
} as const;

export type StylePreset = "dark" | "light";

/** Blend the drawing with its backdrop rather than changing material halfway
 * through a scroll transition. Endpoint palettes stay exactly as authored. */
export const sceneInk = (dark: number) => mix(25, 248, dark);

/** Neutral mirror material follows the actual stage luminance, not the preset.
 * This keeps both Tools drawings identical on their approved backgrounds. */
export function sceneGlass(dark: number) {
  return {
    fill: mix(44, 235, dark),
    edge: mix(40, 244, dark),
    glint: mix(255, 250, dark),
  };
}

// Canvas and DOM read the same palette; UI components do not invent accents.
export const sceneRimColors = [
  sceneColors.accents[0],
  sceneColors.accents[1],
  sceneColors.accents[2],
  "#4d9cff",
  sceneColors.accents[3],
  "#b7ff54",
  "#ffcc2a",
  "#8dff55",
];

// The same hue families need different luminance on paper and on a dark stage.
// Keep this adaptation shared by Canvas and DOM, instead of grayscale overrides.
export const paperAccents = [
  "#c13737",
  "#b57418",
  "#008563",
  "#087f90",
] as const;
const paperRimColors = [
  paperAccents[0],
  paperAccents[1],
  paperAccents[2],
  "#3774ba",
  paperAccents[3],
  "#80992e",
  "#ae861a",
  "#50983c",
];
const channel = (color: string, offset: number) =>
  parseInt(color.slice(offset, offset + 2), 16);
const blendColor = (
  from: string,
  to: string,
  amount: number,
  alpha?: number,
) => {
  if (alpha === undefined && amount <= 0) return from;
  if (alpha === undefined && amount >= 1) return to;
  const channels = [1, 3, 5].map((offset) =>
    Math.round(
      channel(from, offset) +
        (channel(to, offset) - channel(from, offset)) * amount,
    ),
  );
  return alpha === undefined
    ? `rgb(${channels.join(" ")})`
    : `rgba(${channels.join(",")},${alpha})`;
};

// Blend the surface and neutral-preset axes before rounding. Passing generated
// rgb strings back through the hex palette would lose channels mid-transition.
const surfaceColor = (
  paper: string,
  night: string,
  neutralPaper: string,
  neutralNight: string,
  dark: number,
  neutral: number,
  alpha?: number,
) => {
  if (dark <= 0) return blendColor(paper, neutralPaper, neutral, alpha);
  if (dark >= 1) return blendColor(night, neutralNight, neutral, alpha);
  const channels = [1, 3, 5].map((offset) =>
    Math.round(
      mix(
        mix(channel(paper, offset), channel(night, offset), dark),
        mix(channel(neutralPaper, offset), channel(neutralNight, offset), dark),
        neutral,
      ),
    ),
  );
  return alpha === undefined
    ? `rgb(${channels.join(" ")})`
    : `rgba(${channels.join(",")},${alpha})`;
};

export const sceneForeground = (light: number) =>
  blendColor(sceneColors.foreground, "#302e2d", light);

export function sceneRimPalette(paper = 0): readonly string[] {
  if (paper <= 0) return sceneRimColors;
  if (paper >= 1) return paperRimColors;
  return sceneRimColors.map((color, index) =>
    blendColor(color, paperRimColors[index], paper),
  );
}

/** Tools uses the same technical drawing in both presets. Its backdrop remains
 * preset-specific; homepage accents must not inherit this drawing-stage rule. */
export function sceneDrawing(
  progress: number,
  style: StylePreset,
  dark: number,
  projectCount = 4,
) {
  const tools = toolsDrawing(progress);
  const neutral = style === "light" ? 1 - tools : 0;
  const paper = neutral * (1 - dark);
  return {
    paper,
    faceDefinition: 1 + paper * 0.3,
    landOpacity: 1 + paper * 0.08,
    landColor: surfaceColor(
      "#414141",
      sceneAccent(progress, 0, projectCount),
      "#303030",
      "#eeeeee",
      dark,
      neutral,
    ),
    rimOpacity: style === "light" ? mix(1, dark, tools) : dark,
    rimColors: sceneRimPalette(paper),
    highlight: blendColor("#ffc19b", "#f5f5f5", neutral, 0.65),
    ringBase: mix(65, 0, dark),
    ringHighlight: surfaceColor(
      "#505050",
      "#ffc19b",
      "#505050",
      "#f5f5f5",
      dark,
      neutral,
      mix(0.3, 0.65, dark),
    ),
    tickColor: blendColor(
      "#414141",
      sceneAccent(progress, 0, projectCount),
      dark,
      mix(0.4, 1, dark),
    ),
    tickOpacity: mix(0.6, 0.28, dark),
  };
}

export function themeVariables(
  style: StylePreset,
): Record<`--${string}`, string> {
  const light = style === "light";
  return {
    "--scene-background": rgb(light ? surfaces.white : surfaces.dark),
    "--scene-foreground": light ? "#111" : sceneColors.foreground,
    "--paper": rgb(light ? surfaces.white : surfaces.drawing),
    "--muted": light ? "#333" : sceneColors.muted,
    "--panel": light ? "#202020" : sceneColors.panel,
    "--profile-background": rgb(light ? surfaces.black : surfaces.dark),
    "--profile-foreground": sceneColors.foreground,
    "--accent": sceneColors.accents[0],
    "--accent-red": sceneColors.accents[0],
    "--accent-orange": sceneColors.accents[1],
    "--accent-green": sceneColors.accents[2],
    "--accent-cyan": sceneColors.accents[3],
    "--accent-on-paper": paperAccents[0],
    "--contact-foreground": light ? paperAccents[0] : sceneColors.accents[0],
    "--contact-background": light
      ? blendColor("#ffffff", paperAccents[0], 0.08)
      : "#4b2a29",
    "--contact-hover-background": light
      ? blendColor("#ffffff", paperAccents[0], 0.11)
      : "#60302f",
    "--cursor-preview": sceneColors.cursorPreview,
  };
}

export function sceneLight(progress: number, style: StylePreset = "dark") {
  const researchReturn = 1 - smooth(0.36, 0.39, progress);
  if (style === "light") {
    return researchReturn + toolsDrawing(progress);
  }
  return smooth(0.12, 0.22, progress) * researchReturn + toolsDrawing(progress);
}

export function sceneBackground(
  light: number,
  style: StylePreset = "dark",
  intro = 1,
) {
  const from = style === "light" ? surfaces.black : surfaces.dark;
  const to = style === "light" ? surfaces.white : surfaces.drawing;
  const start = style === "light" ? surfaces.white : surfaces.black;
  const reveal = smooth(0, 1, intro);
  return `rgb(${from.map((value, i) => Math.round(start[i] + (value + (to[i] - value) * light - start[i]) * reveal)).join(" ")})`;
}

export function sceneAccent(progress: number, paper = 0, projectCount = 4) {
  const count = Math.max(1, projectCount);
  const span = 0.4 / count;
  const position = (progress - 0.42) / span;
  const index = Math.max(0, Math.min(count - 1, Math.floor(position))) % 4;
  // Chapter headings retain their own palette entries. The shared moving
  // surface crosses each boundary in a short, reversible color transition.
  // Keep the intermediate palette hexadecimal so material blending never
  // reparses a generated rgb string as if it were a six-digit source color.
  const next = Math.round(position);
  const boundary = 0.42 + next * span;
  const blendWidth = Math.min(0.004, span * 0.04);
  if (
    next > 0 &&
    next < count &&
    progress > boundary - blendWidth &&
    progress < boundary + blendWidth
  ) {
    const amount = smooth(
      boundary - blendWidth,
      boundary + blendWidth,
      progress,
    );
    const blendHex = (palette: readonly string[]) =>
      "#" +
      [1, 3, 5]
        .map((offset) =>
          Math.round(
            mix(
              channel(palette[(next - 1) % 4], offset),
              channel(palette[next % 4], offset),
              amount,
            ),
          )
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    return blendColor(
      blendHex(sceneColors.accents),
      blendHex(paperAccents),
      paper,
    );
  }
  return blendColor(sceneColors.accents[index], paperAccents[index], paper);
}
