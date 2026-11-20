import localFont from "next/font/local";

// Newsreader (Production Type, SIL Open Font License; fonts/OFL.txt), self-hosted in instances cut for this site:
// the text face at its 16 pt optical size (regular, semibold, italic) and the display face at 60 pt (roman and
// italic, one weight each) for headings and the greeting. Every page preloads the three faces its first screen
// uses; semibold and italic text load when an article uses them.
//
// Each face is split like Google Fonts serves it: its Latin file covers English and the Western European languages,
// and the Latin Extended files load only on a page that uses their letters (unicode-range). The extended halves are
// separate families, listed first in each stack (pond.module.css), so a letter they lack falls through to the Latin
// face. The fallbacks are sized to Newsreader in host.css (next/font looks only for a local Arial or Times New
// Roman, which Linux lacks), so text keeps its place while the fonts arrive. Loader values must be literals, so the
// ranges are written out.

export const text = localFont({
  src: "./fonts/newsreader-text-latin.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--pond-text",
  adjustFontFallback: false,
  fallback: ["Pond Text Fallback", "Georgia", "serif"],
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

export const textBold = localFont({
  src: "./fonts/newsreader-text-bold-latin.woff2",
  weight: "600",
  style: "normal",
  display: "swap",
  preload: false,
  variable: "--pond-text-bold",
  adjustFontFallback: false,
  fallback: ["Pond Text Bold Fallback", "Georgia", "serif"],
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

export const textItalic = localFont({
  src: "./fonts/newsreader-text-italic-latin.woff2",
  weight: "400",
  style: "italic",
  display: "swap",
  preload: false,
  variable: "--pond-text-italic",
  adjustFontFallback: false,
  fallback: ["Pond Text Italic Fallback", "Georgia", "serif"],
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

export const textExtended = localFont({
  src: [
    { path: "./fonts/newsreader-text-latin-ext.woff2", weight: "400", style: "normal" },
    { path: "./fonts/newsreader-text-bold-latin-ext.woff2", weight: "600", style: "normal" },
    { path: "./fonts/newsreader-text-italic-latin-ext.woff2", weight: "400", style: "italic" },
  ],
  display: "swap",
  preload: false,
  variable: "--pond-text-extended",
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

export const display = localFont({
  src: "./fonts/newsreader-display-latin.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--pond-display",
  adjustFontFallback: false,
  fallback: ["Pond Display Fallback", "Georgia", "serif"],
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

export const displayItalic = localFont({
  src: "./fonts/newsreader-display-italic-latin.woff2",
  weight: "400",
  style: "italic",
  display: "swap",
  variable: "--pond-display-italic",
  adjustFontFallback: false,
  fallback: ["Pond Display Italic Fallback", "Georgia", "serif"],
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

export const displayExtended = localFont({
  src: [
    { path: "./fonts/newsreader-display-latin-ext.woff2", weight: "400", style: "normal" },
    { path: "./fonts/newsreader-display-italic-latin-ext.woff2", weight: "400", style: "italic" },
  ],
  display: "swap",
  preload: false,
  variable: "--pond-display-extended",
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

export const fontVariables = [text, textBold, textItalic, textExtended, display, displayItalic, displayExtended]
  .map((font) => font.variable)
  .join(" ");
