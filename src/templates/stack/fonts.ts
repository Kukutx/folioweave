import localFont from "next/font/local";

// The original's type, self-hosted: Readex Pro (text), Geist Mono (labels), Inter (the shuffle stack's
// cards) and, for the stamps as printed, Courier Prime and Urbanist.
export const readex = localFont({ src: "./fonts/readex-pro.woff2", weight: "160 700", variable: "--f-body" });
export const mono = localFont({ src: "./fonts/geist-mono.woff2", weight: "100 900", variable: "--f-mono" });
export const inter = localFont({ src: "./fonts/inter.woff2", weight: "100 900", variable: "--cs-font", preload: false });
export const typewriter = localFont({
  src: "./fonts/courier-prime.woff2",
  weight: "400",
  variable: "--stamps-type",
  preload: false,
});
export const geometric = localFont({
  src: "./fonts/urbanist.woff2",
  weight: "100 900",
  variable: "--stamps-sans",
  preload: false,
});

export const fontVariables = [readex, mono, inter, typewriter, geometric].map((f) => f.variable).join(" ");
