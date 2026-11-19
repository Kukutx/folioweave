import type { LanyardCard, LanyardSettings } from "./lanyard/engine.ts";
import {
  optionDefaults,
  type BadgeCard,
  type BadgeOptions,
} from "./options.generated.ts";

export type Card = LanyardCard & Pick<BadgeCard, "alt">;

export type BadgeSettings = {
  label?: string;
  scene: Omit<LanyardSettings, "cards"> & { cards: Card[] };
  trigger: Required<Pick<NonNullable<BadgeOptions["trigger"]>, "show" | "side">> & {
    label?: string;
    offsetTop?: number;
  };
  backdrop: Required<NonNullable<BadgeOptions["backdrop"]>>;
  copy: NonNullable<BadgeOptions["copy"]>;
};

/** A card's defaults; the manifest's item schema holds the same values (a
 * test keeps them in step). */
export const cardDefaults = {
  imageFit: "cover",
  finish: "glossy",
  theme: "light",
} as const;

/** A card's colour when the author sets none: its theme's. */
export const themeColors = { light: "#ffffff", dark: "#141416" } as const;

const {
  cards: defaultCards,
  trigger: defaultTrigger,
  backdrop: defaultBackdrop,
  ...sceneDefaults
} = optionDefaults;

/** Options as authored, completed with every default. */
export function badgeSettings(options: Partial<BadgeOptions>): BadgeSettings {
  const {
    label,
    cards = defaultCards as BadgeCard[],
    trigger,
    backdrop,
    copy,
    ...scene
  } = options;
  return {
    label,
    scene: {
      ...sceneDefaults,
      ...scene,
      cards: cards.map((card) => {
        const filled = { ...cardDefaults, ...card };
        return { ...filled, cardColor: card.cardColor ?? themeColors[filled.theme] };
      }),
    },
    trigger: { ...defaultTrigger, ...trigger },
    backdrop: { ...defaultBackdrop, ...backdrop },
    copy: { ...copy },
  };
}

/** Whether the small badge shows on a page. */
export function showsTrigger(
  show: BadgeSettings["trigger"]["show"],
  pathname: string,
) {
  return show === "all" || (show === "home" && pathname === "/");
}
