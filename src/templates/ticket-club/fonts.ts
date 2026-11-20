import localFont from "next/font/local";

// The bill's type, self-hosted (SIL Open Font License 1.1, see fonts/README.md): League Gothic, the
// revival of the condensed gothic that tickets and bills were printed in, for names and titles;
// Newsreader for reading (the summary, the letter, articles); JetBrains Mono for the small print
// (serial numbers, labels, the navigation).
export const display = localFont({
  src: "./fonts/league-gothic.woff2",
  weight: "400",
  variable: "--tc-display",
  fallback: ["Arial Narrow", "Roboto Condensed", "sans-serif"],
});
export const serif = localFont({
  src: "./fonts/newsreader.woff2",
  weight: "200 800",
  variable: "--tc-serif",
  fallback: ["Georgia", "serif"],
});
// Italic is set below the fold only (the letter's signature, emphasis in articles): not preloaded.
export const serifItalic = localFont({
  src: "./fonts/newsreader-italic.woff2",
  weight: "200 800",
  style: "italic",
  variable: "--tc-serif-italic",
  fallback: ["Georgia", "serif"],
  preload: false,
});
export const mono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "100 800",
  variable: "--tc-mono",
  fallback: ["ui-monospace", "Menlo", "Consolas", "monospace"],
});
export const fontVariables = [display, serif, serifItalic, mono]
  .map((f) => f.variable)
  .join(" ");
