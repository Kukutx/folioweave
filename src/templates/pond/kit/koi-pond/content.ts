// Default content for <KoiPond />. Every value can be overridden through props.

export type KoiPalette = {
  /** pale scales */
  white: string;
  /** hi (orange) patches */
  orange: string;
  /** deep red patches */
  red: string;
  /** sumi / dark blue scales */
  navy: string;
  /** eye cells */
  eye: string;
  /** the "o" printed on an eye cell */
  eyeGlyph: string;
  /** the one-cell outline around a body */
  rim: string;
  /** fins and tail */
  fin: string;
  /** dots printed on fins */
  finGlyph: string;
  /** ripple strokes and splash dots */
  line: string;
  /** barbels (whiskers) */
  whisker: string;
  /** the ":" shadow a koi casts down and to the right (darker than the water) */
  shadow: string;
  /** food pellets */
  food: string;
};

export const koiPondContent = {
  /** how many koi swim in the pond */
  fishCount: 10,
  /** one character cell, [width, height] in CSS px, as measured in the recording (shrinks a little in narrow containers) */
  cell: [12, 14] as [number, number],
  /** glyphs printed on the scales; repeat a glyph to make it more frequent */
  glyphs: "XXXXSSSS%%%888",
  /** accessible name of the pond (it is a control: click or Enter drops food) */
  label: "Koi pond",
  /** pellets per drop */
  pellets: [5, 7] as [number, number],
  /** koi colours, picked by the brightness of --paper; --koi-* CSS variables or the palette prop override them */
  palettes: {
    dark: {
      white: "#aaa6a2",
      orange: "#b8693a",
      red: "#a9472b",
      navy: "#423f4f",
      eye: "#0d0d0b",
      eyeGlyph: "#d8d7d3",
      rim: "#2b2a28",
      fin: "#3c3b39",
      finGlyph: "#878683",
      line: "#575754",
      whisker: "#73726f",
      shadow: "#0b0b0a",
      food: "#d0955a",
    },
    light: {
      white: "#a9a7a3",
      orange: "#da9a72",
      red: "#cf654b",
      navy: "#5d5b63",
      eye: "#4c4b49",
      eyeGlyph: "#b3b2ae",
      rim: "#e4e3e0",
      fin: "#dad9d6",
      finGlyph: "#b3b2af",
      line: "#cac9c5",
      whisker: "#8e8d8a",
      shadow: "#d0cfcb",
      food: "#c0874f",
    },
  } satisfies Record<"dark" | "light", KoiPalette>,
};
