import Image from "next/image";
import type { TemplateModule } from "@/core/contracts";
import styles from "./bottega.module.css";
import { MobileMenu } from "./mobile-menu";
import { OpenNow } from "./open-now";
import { ContactButtons, HeaderCta, PhoneLine, Wordmark } from "./parts";
import {
  cities,
  external,
  fill,
  fullAddress,
  hoursLine,
  sharedHoursLine,
  hoursText,
  hoursRows,
  mapsUrl,
  plainText,
  shopOf,
  type Location,
  type Shop,
} from "./shop";

// Monochrome editorial storefront, written for local customers of every age:
// large readable type, plain words and one tap to chat, call or get directions.
const Home: TemplateModule["Home"] = ({ context }) => {
  const shop = shopOf(context);
  const { copy, store, locations } = shop;
  const summary = plainText(context.introduction.summary);
  const roleLine = plainText(context.introduction.roleLine);
  const tagline = store.tagline || roleLine;
  const sharedHours = sharedHoursLine(shop);
  const sameHours = Boolean(sharedHours);
  const footerNav = [
    ...shop.nav,
    ...(context.capabilities.writing ? [{ href: "/blogs", label: copy.navWriting }] : []),
    ...shop.links.map((link) => ({ href: link.href, label: link.label })),
  ];
  const offer = [
    store.catalog && shop.catalogHref
      ? {
          key: "catalog",
          title: store.catalog.cardTitle ?? store.catalog.title,
          text: store.catalog.cardText ?? store.catalog.intro,
          image: store.catalog.image,
          alt: store.catalog.imageAlt ?? "",
          label: store.catalog.imageLabel,
          href: shop.catalogHref,
          link: copy.catalogLink,
        }
      : null,
    store.services && shop.servicesHref
      ? {
          key: "services",
          title: store.services.cardTitle ?? store.services.title,
          text: store.services.cardText ?? store.services.intro,
          image: store.services.image,
          alt: store.services.imageAlt ?? "",
          label: store.services.imageLabel,
          href: shop.servicesHref,
          link: copy.servicesLink,
        }
      : null,
  ].filter((item) => item !== null);
  const quickActions = shop.whatsapp() ? shop.quickActions : [];

  return (
    <div id="top" className={styles.home}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <a
            href="#top"
            className={styles.brand}
            aria-label={`${shop.name} — ${copy.topOfPage}`}
          >
            <Wordmark shop={shop} />
          </a>
          <div className={styles.headerActions}>
            <nav className={styles.nav} aria-label={copy.mainNavigation}>
              {shop.nav.map((item) => (
                <a key={item.href} href={item.href} className={styles.navLink}>
                  {item.label}
                </a>
              ))}
            </nav>
            <HeaderCta shop={shop} />
            <MobileMenu
              items={shop.nav}
              openLabel={copy.openMenu}
              closeLabel={copy.closeMenu}
              navLabel={copy.mobileNavigation}
            />
          </div>
        </div>
      </header>

      <main id="content">
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <h1 className={styles.heroTitle}>
              <Wordmark shop={shop} />
            </h1>
            {tagline && (
              <p className={styles.heroTagline}>
                <span aria-hidden="true" className={styles.rule} />
                <span>{tagline}</span>
                <span aria-hidden="true" className={styles.rule} />
              </p>
            )}
            {locations.length > 0 && (
              <p className={styles.heroDetail}>{cities(locations).join(" · ")}</p>
            )}
            {summary && <p className={styles.heroIntro}>{summary}</p>}
            <div className={styles.heroActions}>
              <ContactButtons shop={shop} chatLabel={copy.whatsappCta} callWithNumber />
            </div>
            {locations.length > 0 && (
              <a href="#stores" className={styles.whereLink}>
                {copy.whereLink}
              </a>
            )}
          </div>
        </section>

        {quickActions.length > 0 && (
          <section id="help" className={styles.band} aria-labelledby="help-heading">
            <div className={`${styles.container} ${styles.bandInner}`}>
              <h2 id="help-heading" className={styles.sectionTitle}>
                {copy.quickTitle}
              </h2>
              {copy.quickIntro && (
                <p className={`${styles.lead} ${styles.helpIntro}`}>{copy.quickIntro}</p>
              )}
              <ul className={styles.helpList}>
                {quickActions.map((action) => {
                  const href = shop.whatsapp(action.message)!;
                  return (
                    <li key={action.title}>
                      <a href={href} {...external(href)} className={styles.helpCard}>
                        <span className={styles.helpTitle}>{action.title}</span>
                        {action.detail && (
                          <span className={styles.helpDetail}>{action.detail}</span>
                        )}
                        <span className={styles.helpCta}>{copy.quickCta}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {offer.length > 0 && (
          <section id="services" className={`${styles.container} ${styles.block}`}>
            <h2 className={`${styles.sectionTitle} ${styles.servicesTitle}`}>
              {copy.servicesTitle}
            </h2>
            <div className={styles.cards}>
              {offer.map((item) => (
                <article key={item.key} className={styles.card}>
                  {item.image && (
                    <div className={styles.media}>
                      <Image
                        src={item.image}
                        alt={item.alt}
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      {item.label && <span className={styles.imageLabel}>{item.label}</span>}
                    </div>
                  )}
                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{item.title}</h3>
                    {item.text && (
                      <p className={`${styles.lead} ${styles.cardText}`}>{item.text}</p>
                    )}
                    <a href={item.href} className={`${styles.textLink} ${styles.cardLink}`}>
                      {item.link}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {locations.length > 0 && (
          <section id="stores" className={`${styles.container} ${styles.block}`}>
            <h2
              className={`${styles.sectionTitle} ${copy.storesIntro ? "" : styles.storesTitleAlone}`}
            >
              {copy.storesTitle}
            </h2>
            {copy.storesIntro && (
              <p className={`${styles.lead} ${styles.storesIntro}`}>{copy.storesIntro}</p>
            )}
            <div className={styles.storeGrid}>
              {locations.map((location) => (
                <StoreCard
                  key={location.id}
                  shop={shop}
                  location={location}
                  timeZone={context.site.location.timeZone}
                />
              ))}
            </div>
          </section>
        )}

        <section id="contact" className={`${styles.band} ${styles.contact}`}>
          <h2 className={styles.sectionTitle}>{copy.contactTitle}</h2>
          {copy.contactText && (
            <p className={`${styles.lead} ${styles.contactText}`}>{copy.contactText}</p>
          )}
          {shop.phone && (
            <a href={`tel:${shop.phone}`} className={styles.bigPhone}>
              {shop.displayPhone}
            </a>
          )}
          <div className={styles.contactActions}>
            <ContactButtons shop={shop} chatLabel={copy.whatsappCta} callWithNumber={false} />
            {shop.email && (shop.phone || shop.whatsapp()) && (
              <a href={`mailto:${shop.email}`} className={styles.textLinkLg}>
                {shop.email}
              </a>
            )}
          </div>
          {shop.links.length > 0 && (
            <>
              {copy.follow && <p className={styles.followLabel}>{copy.follow}</p>}
              <ul className={styles.followLinks}>
                {shop.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} {...external(link.href)} className={styles.textLinkLg}>
                      {link.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <div className={styles.footerInfo}>
            <p className={styles.footerBrand}>
              <Wordmark shop={shop} />
            </p>
            <p className={styles.footerText}>{context.site.identity.role}</p>
            {locations.map((location) => (
              <p key={location.id} className={styles.footerLine}>
                <strong className={styles.footerBlockName}>{location.name}</strong>
                {fullAddress(location) || location.city}
                {!sameHours && hoursText(location, shop.locale) && (
                  <>
                    <br />
                    {hoursLine(hoursText(location, shop.locale))}
                  </>
                )}
              </p>
            ))}
            {sharedHours && <p className={styles.footerLine}>{sharedHours}</p>}
            <PhoneLine shop={shop} />
            <p className={styles.copyright}>
              © {context.site.copyrightYear} {shop.name}
            </p>
          </div>
          <nav className={styles.footerNav} aria-label={copy.footerNavigation}>
            {footerNav.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
};
export default Home;

function StoreCard({
  shop,
  location,
  timeZone,
}: {
  shop: Shop;
  location: Location;
  timeZone: string;
}) {
  const { copy } = shop;
  const address = fullAddress(location);
  const map = mapsUrl(location);
  const ask = shop.whatsapp(fill(copy.inquireMessage, { city: location.city }));
  const hours = hoursRows(hoursText(location, shop.locale));
  return (
    <article className={styles.storeCard}>
      {location.image && (
        <div className={`${styles.media} ${styles.storeImage}`}>
          <Image
            src={location.image}
            alt={location.imageAlt ?? ""}
            fill
            unoptimized
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          {location.imageCredit && (
            <span className={styles.imageLabel}>{location.imageCredit}</span>
          )}
        </div>
      )}
      <p className={`${styles.eyebrow} ${styles.storeKicker}`}>{location.city}</p>
      <h3 className={styles.storeName}>{location.name}</h3>
      {location.tagline && <p className={styles.storeTagline}>{location.tagline}</p>}
      {location.mapName && (
        <p className={styles.mapName}>{fill(copy.mapName, { name: location.mapName })}</p>
      )}

      {location.highlights && location.highlights.length > 0 && (
        <>
          <h4 className={styles.storeLabel}>{copy.findHere}</h4>
          <ul className={styles.highlights}>
            {location.highlights.map((item) => (
              <li key={item}>
                <span aria-hidden="true">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <dl className={styles.facts}>
        {hours.length > 0 && (
          <div>
            <dt className={styles.factLabel}>{copy.hours}</dt>
            <dd className={styles.factValue}>
              {hours.map((row, index) => (
                <p
                  key={`${index}-${row.text}`}
                  className={
                    row.kind === "time"
                      ? styles.hoursTime
                      : row.kind === "remark"
                        ? styles.hoursRemark
                        : styles.hoursText
                  }
                >
                  {row.text}
                </p>
              ))}
              {location.openingHours && location.openingHours.length > 0 && (
                <OpenNow
                  entries={location.openingHours}
                  timeZone={timeZone}
                  locale={shop.locale}
                  country={location.country}
                  labels={{
                    statusOpen: copy.statusOpen,
                    statusOpensLater: copy.statusOpensLater,
                    statusReopens: copy.statusReopens,
                    statusClosedToday: copy.statusClosedToday,
                    tomorrow: copy.tomorrow,
                  }}
                />
              )}
            </dd>
          </div>
        )}
        <div>
          <dt className={styles.factLabel}>{copy.address}</dt>
          <dd className={styles.factValue}>
            {address ? (
              <address className={styles.address}>{address}</address>
            ) : (
              <span className={styles.pending}>{copy.addressPending}</span>
            )}
          </dd>
        </div>
        {location.phone && (
          <div>
            <dt className={styles.factLabel}>{copy.phone}</dt>
            <dd className={styles.factValue}>
              <a href={`tel:${location.phone}`} className={styles.address}>
                {location.phone}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <div className={styles.storeActions}>
        {map && (
          <a href={map} {...external(map)} className={styles.btnPrimary}>
            {copy.directions} ↗
          </a>
        )}
        {ask && (
          <a href={ask} {...external(ask)} className={styles.btnOutline}>
            {copy.inquire}
          </a>
        )}
        {location.links?.map((link) => (
          <a
            key={link.href}
            href={link.href}
            {...external(link.href)}
            className={styles.textLink}
          >
            {link.label} ↗
          </a>
        ))}
      </div>
    </article>
  );
}
