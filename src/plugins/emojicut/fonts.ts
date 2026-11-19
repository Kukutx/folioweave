import { Fredoka, Mali, Noto_Sans_SC } from "next/font/google";

/*
 * The original loads these three families and weights from Google Fonts at
 * runtime. The site's CSP only allows its own fonts, so next/font downloads
 * the same files at build time and serves them from this site.
 */
export const mali = Mali({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
});

export const fredoka = Fredoka({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  preload: false,
});

export const notoSansSC = Noto_Sans_SC({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  preload: false,
});

/** The family a loader registered, without the metric fallback it appends. */
const family = (font: { style: { fontFamily: string } }) =>
  font.style.fontFamily.split(",")[0].trim();

/**
 * The original's stack: 'Mali', 'Fredoka', 'Noto Sans SC', system fonts.
 * Built from the registered names so that no Arial-based fallback face sits
 * between them and catches glyphs Mali lacks.
 */
export const fontStack = [
  family(mali),
  family(fredoka),
  family(notoSansSC),
  "-apple-system",
  "BlinkMacSystemFont",
  '"Segoe UI"',
  "sans-serif",
].join(", ");
