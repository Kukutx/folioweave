import localFont from "next/font/local";

// The paper's type (the personal edition's envelope and letter, and articles on the same paper), as in
// the original's edition: Caveat, Caveat Brush, Crimson Pro and Outfit (the stamps' lettering); its Inter
// is the line's own (fonts.ts), mapped to --font-sans in edition.module.css.
export const script = localFont({ src: "./fonts/caveat.woff2", weight: "400 700", variable: "--font-script" });
export const hand = localFont({ src: "./fonts/caveat-brush.woff2", weight: "400", variable: "--font-hand" });
export const serif = localFont({ src: "./fonts/crimson-pro.woff2", weight: "200 900", variable: "--font-serif" });
export const stamp = localFont({ src: "./fonts/outfit.woff2", weight: "100 900", variable: "--font-stamp", preload: false });
export const paperFonts = [script, hand, serif, stamp].map((f) => f.variable).join(" ");
