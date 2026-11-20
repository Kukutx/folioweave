import localFont from "next/font/local";

// The line's type, self-hosted as in the original: JetBrains Mono (labels, stubs), Barlow Condensed
// (titles) and Inter (lines of text).
export const mono = localFont({ src: "./fonts/jetbrains-mono-latin.woff2", weight: "100 800", display: "swap", variable: "--tc-mono" });
export const cond = localFont({ src: "./fonts/barlow-condensed.woff2", weight: "600", variable: "--tc-cond" });
export const inter = localFont({ src: "./fonts/inter.woff2", weight: "100 900", variable: "--tc-inter" });
