import type { Viewport } from "next";
import { rootMetadata, personJsonLd } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { serializeJsonLd } from "@/lib/json-ld";
import "./globals.css";
import "@/styles/theme.css";
import "@/styles/interactive-effects.css";

export const metadata = rootMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: siteConfig.themeColor,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={siteConfig.identity.locale}>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd) }}
        />
      </body>
    </html>
  );
}
