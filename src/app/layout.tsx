import type { Viewport } from "next";
import { rootMetadata, personJsonLd } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { serializeJsonLd } from "@/lib/json-ld";
import "./globals.css";
import "@/styles/theme.css";
import "@/styles/interactive-effects.css";
import "@/styles/media.css";
import "@/styles/motion.css";

export const metadata = rootMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: siteConfig.themeColor,
};

const homeReloadScrollReset = `
(() => {
  const navigation = performance.getEntriesByType("navigation")[0];
  if (
    location.pathname !== "/" ||
    location.hash ||
    navigation?.type !== "reload"
  ) return;

  const previous = history.scrollRestoration;
  history.scrollRestoration = "manual";
  scrollTo(0, 0);
  addEventListener(
    "pageshow",
    () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollTo(0, 0);
          history.scrollRestoration = previous;
        });
      });
    },
    { once: true },
  );
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={siteConfig.identity.locale}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: homeReloadScrollReset }} />
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd) }}
        />
      </body>
    </html>
  );
}
