// Generated from manifest.json by scripts/plugin-contracts.mjs. Do not edit.

export interface BadgeOptions {
  /**
   * Accessible name of the open badge; defaults to a localised “Badge”.
   */
  label?: string;
  /**
   * The cards on the hook, front to back: pictures (frontImage, backImage), or a face drawn from logo, title, kicker and description.
   *
   * @minItems 1
   * @maxItems 6
   */
  cards?:
    | [BadgeCard]
    | [BadgeCard, BadgeCard]
    | [BadgeCard, BadgeCard, BadgeCard]
    | [BadgeCard, BadgeCard, BadgeCard, BadgeCard]
    | [BadgeCard, BadgeCard, BadgeCard, BadgeCard, BadgeCard]
    | [BadgeCard, BadgeCard, BadgeCard, BadgeCard, BadgeCard, BadgeCard];
  orientation?: "portrait" | "landscape";
  /**
   * Roundness of the card's corners, 0 to 1.
   */
  cornerRadius?: number;
  /**
   * Card height as a share of the view's height.
   */
  size?: number;
  /**
   * Where the strap hangs from across the view.
   */
  anchor?: "left" | "center" | "right";
  /**
   * How far down the card hangs, 0 to 1.
   */
  strapLength?: number;
  /**
   * Picture printed along the strap, repeated.
   */
  strapImage?: string;
  strapColor?: string;
  strapWidth?: number;
  /**
   * v: two bands that meet at the sleeve, as worn round the neck. single: one band.
   */
  strapStyle?: "v" | "single";
  /**
   * How fast the two bands of a v part above the sleeve.
   */
  strapSpread?: number;
  /**
   * clasp: sleeve, D-ring and lobster clasp through a round hole. ring: clamp and ring through a slot.
   */
  hardware?: "clasp" | "ring";
  /**
   * The sleeve's metal; the clasp is a darker cast of it.
   */
  metal?: "silver" | "gold" | "graphite";
  gravity?: number;
  /**
   * How quickly the swing settles.
   */
  damping?: number;
  /**
   * How much the strap stretches.
   */
  elasticity?: number;
  /**
   * A slow drift of air; off for visitors who ask for less motion.
   */
  breeze?: number;
  /**
   * Cards can be dragged, thrown and tapped to flip.
   */
  interactive?: boolean;
  /**
   * The cards swing in from the side when the badge opens.
   */
  intro?: boolean;
  introFrom?: "left" | "right";
  /**
   * A soft shadow behind the strap and cards.
   */
  shadow?: boolean;
  trigger?: {
    /**
     * Pages that show the small badge hanging from the top edge; #badge links open the badge on every page.
     */
    show?: "home" | "all" | "none";
    side?: "right" | "left";
    /**
     * Accessible name of the small badge; defaults to a localised “Open badge”.
     */
    label?: string;
    /**
     * Extra strap length in pixels, to hang the small badge lower.
     */
    offsetTop?: number;
  };
  backdrop?: {
    color?: string;
    opacity?: number;
    /**
     * Blur of the page behind, in pixels.
     */
    blur?: number;
  };
  /**
   * Replaces the built-in English or Chinese wording.
   */
  copy?: {
    open?: string;
    close?: string;
    hint?: string;
  };
}
export interface BadgeCard {
  /**
   * Picture printed on the front, drawn over cardColor.
   */
  frontImage?: string;
  /**
   * Picture printed on the back; the front's picture when omitted.
   */
  backImage?: string;
  /**
   * What the card says, read to screen readers.
   */
  alt?: string;
  /**
   * Colours of a face drawn from text, and the card's colour unless cardColor is set.
   */
  theme?: "light" | "dark";
  /**
   * Mark in the roundel of a face drawn from text.
   */
  logo?: string;
  /**
   * Without a frontImage, the face is drawn: a roundel with the logo over a grid, then title, kicker and description.
   */
  title?: string;
  /**
   * Short line in monospace capitals under the title.
   */
  kicker?: string;
  description?: string;
  imageFit?: "cover" | "contain";
  /**
   * The card's colour; white, or near black for the dark theme, when omitted.
   */
  cardColor?: string;
  finish?: "glossy" | "matte" | "holographic" | "metallic";
}

export const optionDefaults = {
  cards: [{}],
  orientation: "portrait",
  cornerRadius: 0.155,
  size: 0.4,
  anchor: "center",
  strapLength: 1,
  strapColor: "#6d6d6d",
  strapWidth: 0.65,
  strapStyle: "v",
  strapSpread: 0.23,
  hardware: "clasp",
  metal: "silver",
  gravity: 1,
  damping: 0.5,
  elasticity: 0.5,
  breeze: 0.5,
  interactive: true,
  intro: true,
  introFrom: "left",
  shadow: true,
  trigger: { show: "home", side: "right" },
  backdrop: { color: "#dbe6f7", opacity: 0.8, blur: 14 },
} satisfies Partial<BadgeOptions>;
