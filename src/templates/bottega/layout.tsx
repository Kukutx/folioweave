import type { CSSProperties } from "react";
import type { TemplateContext, TemplateModule } from "@/core/contracts";
import { serializeJsonLd } from "@/lib/json-ld";
import styles from "./bottega.module.css";
import { sans, sansExtended, serif, serifExtended } from "./fonts";
import { DAYS, external, mapsUrl, shopOf } from "./shop";
import "./host.css";

const SCHEMA_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const absolute = (origin: string, href: string) =>
  href.startsWith("/") ? `${origin}${href}` : href;
const https = (links: readonly { href: string }[] = []) =>
  links.map((link) => link.href).filter((href) => href.startsWith("https://"));

/** The shop and each location as schema.org data, as the original publishes it. */
function structuredData(context: TemplateContext) {
  const { site, store } = context;
  const origin = site.origin;
  const contact = store.contact ?? {};
  const language = (() => {
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(
        new Intl.Locale(site.identity.locale).language,
      );
    } catch {
      return undefined;
    }
  })();
  const sameAs = https(contact.links);
  const telephone = contact.phone ?? contact.whatsapp;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.identity.name,
    url: origin,
    logo: absolute(origin, site.assets.icon),
    ...(sameAs.length ? { sameAs } : {}),
    ...(telephone || contact.email
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            ...(telephone ? { telephone } : {}),
            ...(contact.email ? { email: contact.email } : {}),
            contactType: "customer service",
            ...(language ? { availableLanguage: [language] } : {}),
          },
        }
      : {}),
    subOrganization: store.locations.map((location) => {
      const map = mapsUrl(location);
      const links = https(location.links);
      const phone = location.phone ?? telephone;
      return {
        "@type": "LocalBusiness",
        name: location.name,
        ...(location.mapName ? { alternateName: location.mapName } : {}),
        url: origin,
        image: absolute(origin, location.image ?? site.assets.socialPreview),
        ...(phone ? { telephone: phone } : {}),
        ...(map ? { hasMap: map } : {}),
        ...(links.length ? { sameAs: links } : {}),
        ...(location.openingHours?.length
          ? {
              openingHoursSpecification: location.openingHours.map((entry) => ({
                "@type": "OpeningHoursSpecification",
                dayOfWeek: DAYS.filter((day) => entry.days.includes(day)).map(
                  (day) => SCHEMA_DAYS[DAYS.indexOf(day)],
                ),
                opens: entry.opens,
                closes: entry.closes,
              })),
            }
          : {}),
        address: {
          "@type": "PostalAddress",
          ...(location.street
            ? {
                streetAddress: location.street,
                ...(location.postalCode ? { postalCode: location.postalCode } : {}),
              }
            : {}),
          addressLocality: location.city,
          ...(location.region ? { addressRegion: location.region } : {}),
          ...(location.country ? { addressCountry: location.country } : {}),
        },
      };
    }),
  };
}

const Layout: TemplateModule["Layout"] = ({ children, context, slots }) => {
  const shop = shopOf(context);
  const whatsapp = shop.whatsapp();
  const bar = [
    whatsapp && { href: whatsapp, label: shop.copy.whatsapp },
    shop.phone && { href: `tel:${shop.phone}`, label: shop.copy.call },
  ].filter((item): item is { href: string; label: string } => Boolean(item));
  return (
    <>
      <div
        className={`${sans.variable} ${serif.variable} ${sansExtended.variable} ${serifExtended.variable} ${styles.shell}`}
        data-bar={bar.length ? "" : undefined}
      >
        <a href="#content" className={styles.skip}>
          {shop.copy.skipToContent}
        </a>
        {context.store.locations.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd(structuredData(context)),
            }}
          />
        )}
        {children}
        {bar.length > 0 && (
          <nav
            aria-label={shop.copy.quickContact}
            className={styles.bar}
            data-bottega-bar=""
            style={{ "--bar-columns": bar.length } as CSSProperties}
          >
            {bar.map((item) => (
              <a
                key={item.href}
                href={item.href}
                {...external(item.href)}
                className={styles.barLink}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        {slots.footer}
      </div>
      {slots.floating}
    </>
  );
};
export default Layout;
