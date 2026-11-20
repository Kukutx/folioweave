import localFont from "next/font/local";

// Stack's type, self-hosted (all SIL Open Font License, see fonts/FONTS.md):
// Instrument Serif for the names and titles, Source Serif 4 for reading and
// Geist Mono for the typed labels. The two serifs are split like Google Fonts
// serves them: the Latin file covers English and most western European text,
// the Latin Extended file loads only for pages that use those letters
// (unicode-range). Each half is a font family of its own, listed extended
// first in shell.css: a letter outside the extended range falls through to the
// Latin family and its metric-matched fallback. Font loader values must be
// literals, so the ranges are written out.
//
// The metric-matched fallbacks live in shell.css rather than being generated:
// next/font looks only for a local Times New Roman or Arial, which Linux
// lacks. shell.css keeps next/font's own overrides for these files and also
// accepts their metric twins (Liberation, Tinos, Cousine).

export const display = localFont({
  src: [
    {
      path: "./fonts/instrument-serif-latin.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/instrument-serif-italic-latin.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--st-display",
  adjustFontFallback: false,
  fallback: [
    "Stack Display Fallback",
    "Songti SC",
    "Noto Serif CJK SC",
    "serif",
  ],
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
    {
      path: "./fonts/instrument-serif-latin-ext.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/instrument-serif-italic-latin-ext.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--st-display-ext",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

export const text = localFont({
  src: [
    {
      path: "./fonts/source-serif-latin.woff2",
      weight: "400 600",
      style: "normal",
    },
    {
      path: "./fonts/source-serif-italic-latin.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--st-text",
  adjustFontFallback: false,
  fallback: ["Stack Text Fallback", "Songti SC", "Noto Serif CJK SC", "serif"],
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
    {
      path: "./fonts/source-serif-latin-ext.woff2",
      weight: "400 600",
      style: "normal",
    },
    {
      path: "./fonts/source-serif-italic-latin-ext.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--st-text-ext",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

export const mono = localFont({
  src: "./fonts/geist-mono.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--st-mono",
  adjustFontFallback: false,
  fallback: ["Stack Mono Fallback", "ui-monospace", "monospace"],
});

export const fontVariables = [
  display,
  displayExtended,
  text,
  textExtended,
  mono,
]
  .map((font) => font.variable)
  .join(" ");
