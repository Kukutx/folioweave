import Link from "next/link";
import type { ReactNode } from "react";
import type { TemplateContext } from "@/core/contracts";
import styles from "./bottega.module.css";
import {
  external,
  fullAddress,
  hoursLine,
  sharedHoursLine,
  hoursText,
  shopOf,
  type Shop,
} from "./shop";

/** The brand as real text: the first word upright, the rest in italic. */
export function Wordmark({ shop }: { shop: Shop }) {
  const [first, ...rest] = shop.name.trim().split(/\s+/);
  if (shop.wordmark === "plain" || !rest.length) return <>{shop.name}</>;
  return (
    <>
      {first} <span className={styles.italic}>{rest.join(" ")}</span>
    </>
  );
}

/** Header and footer of every page other than the home page. */
export function SubpageShell({
  context,
  children,
}: {
  context: TemplateContext;
  children: ReactNode;
}) {
  const shop = shopOf(context);
  const { copy } = shop;
  const hours = sharedHoursLine(shop);
  const sameHours = Boolean(hours);
  return (
    <div>
      <header className={styles.subHeader}>
        <div className={`${styles.container} ${styles.subHeaderInner}`}>
          <Link
            href="/"
            aria-label={`${shop.name} — ${copy.backToHomeLabel}`}
            className={styles.subBrand}
          >
            <Wordmark shop={shop} />
          </Link>
          <div className={styles.subActions}>
            <Link href="/" className={styles.homeLink}>
              {copy.backHome}
            </Link>
            <HeaderCta shop={shop} />
          </div>
        </div>
      </header>
      {children}
      <footer className={styles.subFooter}>
        <div className={`${styles.container} ${styles.subFooterInner}`}>
          <div className={styles.subFooterInfo}>
            <p className={styles.subFooterBrand}>{shop.name}</p>
            {shop.locations.map((location) => (
              <p key={location.id} className={styles.footerLine}>
                <strong>{location.name}</strong> ·{" "}
                {fullAddress(location) || location.city}
                {!sameHours && hoursText(location, shop.locale) && (
                  <>
                    <br />
                    {hoursLine(hoursText(location, shop.locale))}
                  </>
                )}
              </p>
            ))}
            {hours && <p className={styles.footerLine}>{hours}</p>}
            <PhoneLine shop={shop} />
          </div>
          <Link href="/" className={styles.subFooterLink}>
            {copy.backHomeFooter}
          </Link>
        </div>
      </footer>
    </div>
  );
}

/** The black button at the top right: WhatsApp, else call, else email. */
export function HeaderCta({ shop }: { shop: Shop }) {
  const { copy } = shop;
  const whatsapp = shop.whatsapp();
  if (whatsapp)
    return (
      <a
        href={whatsapp}
        {...external(whatsapp)}
        aria-label={copy.whatsappCta}
        className={styles.headerCta}
      >
        {copy.whatsapp}
      </a>
    );
  if (shop.phone)
    return (
      <a href={`tel:${shop.phone}`} className={styles.headerCta}>
        {copy.call}
      </a>
    );
  if (shop.email)
    return (
      <a href={`mailto:${shop.email}`} className={styles.headerCta}>
        {copy.email}
      </a>
    );
  return null;
}

/** "Telefono e WhatsApp: 000 000 0000", or nothing without a number. */
export function PhoneLine({ shop }: { shop: Shop }) {
  if (!shop.phone) return null;
  return (
    <p className={styles.footerText}>
      {shop.phoneLabel}{" "}
      <a href={`tel:${shop.phone}`} className={styles.footerPhone}>
        {shop.displayPhone}
      </a>
    </p>
  );
}

/** Primary chat button and secondary call button, as the original pairs them. */
export function ContactButtons({
  shop,
  chatLabel,
  message,
  callWithNumber,
}: {
  shop: Shop;
  chatLabel: string;
  message?: string;
  callWithNumber: boolean;
}) {
  const whatsapp = shop.whatsapp(message);
  return (
    <>
      {whatsapp ? (
        <a href={whatsapp} {...external(whatsapp)} className={styles.btnPrimaryLg}>
          {chatLabel}
        </a>
      ) : (
        !shop.phone &&
        shop.email && (
          <a href={`mailto:${shop.email}`} className={styles.btnPrimaryLg}>
            {shop.copy.email}
          </a>
        )
      )}
      {shop.phone && (
        <a
          href={`tel:${shop.phone}`}
          className={whatsapp ? styles.btnOutlineLg : styles.btnPrimaryLg}
        >
          {shop.copy.call}
          {callWithNumber && ` ${shop.displayPhone}`}
        </a>
      )}
    </>
  );
}

/** Each location's name and city over a short line, as on the inner pages. */
export function LocationStrip({
  shop,
  className,
  withAddress,
  page,
}: {
  shop: Shop;
  className: string;
  withAddress: boolean;
  /** The page showing the strip: a location may say something for it alone. */
  page: "catalog" | "services";
}) {
  if (shop.locations.length < 2) return null;
  return (
    <div className={`${styles.strip} ${className}`}>
      {shop.locations.map((location) => (
        <div key={location.id} className={styles.stripItem}>
          <p className={styles.stripName}>
            {location.name} · {location.city}
          </p>
          {(location.notes?.[page] ?? location.note) ? (
            <p className={`${styles.lead} ${styles.stripNote}`}>
              {location.notes?.[page] ?? location.note}
            </p>
          ) : location.highlights?.length ? (
            <p className={`${styles.lead} ${styles.stripNote}`}>
              {location.highlights.join(" · ")}
            </p>
          ) : (
            location.tagline && (
              <p className={`${styles.lead} ${styles.stripNote}`}>
                {location.tagline}
              </p>
            )
          )}
          {withAddress && fullAddress(location) && (
            <p className={styles.stripAddress}>{fullAddress(location)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
