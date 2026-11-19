import localFont from "next/font/local";

// The carrier page's typeface (Geist Mono), self-hosted. Not preloaded: the root 404 is part of every page's
// segment, so a preload would make every page fetch a font only the 404 uses.
export const mono = localFont({ src: "./geist-mono.woff2", weight: "100 900", preload: false });
