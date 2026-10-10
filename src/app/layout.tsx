import type { Viewport } from "next";
import { rootMetadata, personJsonLd } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { serializeJsonLd } from "@/lib/json-ld";
import { templateId } from "@/portfolio/template.generated";
import TemplateLayout from "@/portfolio/template-layout.generated";
import FooterPlugins from "@/portfolio/plugins-site-footer.generated";
import FloatingPlugins from "@/portfolio/plugins-site-floating.generated";
import { templateContext } from "@/core/template-context";

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
    <html lang={siteConfig.identity.locale} data-template={templateId}>
      <body>
        <TemplateLayout
          context={templateContext}
          slots={{
            footer: (
              <FooterPlugins context={{ locale: siteConfig.identity.locale }} />
            ),
            floating: (
              <FloatingPlugins
                context={{ locale: siteConfig.identity.locale }}
              />
            ),
          }}
        >
          {children}
        </TemplateLayout>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd) }}
        />
      </body>
    </html>
  );
}
