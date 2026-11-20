import { notFound } from "next/navigation";
import type { TemplateContext } from "@/core/contracts";
import styles from "./bottega.module.css";
import { ContactButtons, LocationStrip, SubpageShell } from "./parts";
import { external, shopOf } from "./shop";

/** Services with reference prices. Published only with a services block. */
export default function ServicesPage({ context }: { context: TemplateContext }) {
  const services = context.store.services;
  if (!services) notFound();
  const shop = shopOf(context);
  const { copy, steps } = shop;
  const askPrice = shop.whatsapp(copy.priceMessage);
  const showStrip = shop.locations.length > 1;
  const note = services.note || copy.priceNote;
  const separateId = (context.options as { separateGroup?: string }).separateGroup;
  const separate = services.groups.find((group) => group.id === separateId);
  const grid = services.groups.filter((group) => group !== separate);
  return (
    <SubpageShell context={context}>
      <main id="content">
        <section
          className={`${styles.container} ${styles.pageIntro} ${styles.pageIntroServices}`}
        >
          <p className={`${styles.eyebrow} ${styles.servicesKicker}`}>
            {copy.servicesEyebrow}
          </p>
          <h1 className={styles.servicesTitleLg}>{services.title}</h1>
          {services.intro && (
            <p className={`${styles.lead} ${styles.muted} ${styles.pageLead}`}>
              {services.intro}
            </p>
          )}
          {(askPrice || shop.phone) && (
            <div className={styles.pageActions}>
              {askPrice && (
                <a href={askPrice} {...external(askPrice)} className={styles.btnPrimaryLg}>
                  {copy.askPrice}
                </a>
              )}
              {shop.phone && (
                <a
                  href={`tel:${shop.phone}`}
                  className={askPrice ? styles.btnOutlineLg : styles.btnPrimaryLg}
                >
                  {copy.call} {shop.displayPhone}
                </a>
              )}
            </div>
          )}
        </section>

        {(steps.length > 0 || showStrip) && (
          <section className={styles.how} aria-labelledby={steps.length ? "how-heading" : undefined}>
            <div className={`${styles.container} ${styles.howInner}`}>
              {steps.length > 0 && (
                <>
                  <h2 id="how-heading" className={styles.sectionTitle}>
                    {copy.stepsTitle}
                  </h2>
                  <ol className={styles.steps}>
                    {steps.map((step, index) => (
                      <li key={`${index}-${step.title}`} className={styles.step}>
                        <span className={styles.stepNumber}>{index + 1}</span>
                        <h3 className={styles.stepTitle}>{step.title}</h3>
                        {step.detail && (
                          <p className={`${styles.lead} ${styles.stepText}`}>{step.detail}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {showStrip && (
                <>
                  <h2 className={styles.whichTitle}>{copy.whichStore}</h2>
                  <LocationStrip shop={shop} className={styles.whichStrip} withAddress page="services" />
                </>
              )}
            </div>
          </section>
        )}

        <section
          className={`${styles.container} ${styles.pageSection}`}
          aria-labelledby="prices-heading"
        >
          <div className={styles.priceHead}>
            <div>
              <span className={styles.eyebrow}>{copy.priceListEyebrow}</span>
              <h2
                id="prices-heading"
                className={`${styles.sectionTitle} ${styles.priceTitle}`}
              >
                {copy.priceListTitle}
              </h2>
            </div>
            {copy.priceListAside && <p className={styles.priceAside}>{copy.priceListAside}</p>}
          </div>

          <div className={styles.priceGrid}>
            {grid.map((group, index) => (
              <section
                key={group.id}
                id={group.id}
                className={styles.priceGroup}
                aria-labelledby={`title-${group.id}`}
              >
                <div className={styles.priceGroupHead}>
                  <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                  <h3 id={`title-${group.id}`} className={styles.priceGroupName}>
                    {group.name}
                  </h3>
                </div>
                <dl>
                  {group.items.map((item, itemIndex) => (
                    <div key={`${itemIndex}-${item.name}`} className={styles.priceRow}>
                      <dt className={styles.priceName}>
                        {item.name}
                        {item.note && <span className={styles.priceNote}>{item.note}</span>}
                      </dt>
                      <dd className={styles.price}>{item.price}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          {separate && (
            <section
              id={separate.id}
              className={styles.otherGroup}
              aria-labelledby={`title-${separate.id}`}
            >
              <h3 id={`title-${separate.id}`} className={styles.priceGroupName}>
                {separate.name}
              </h3>
              {separate.items.map((item, itemIndex) => (
                <div key={`${itemIndex}-${item.name}`} className={styles.otherRow}>
                  <span>
                    {item.name}
                    {item.note && <span className={styles.priceNote}>{item.note}</span>}
                  </span>
                  <strong>{item.price}</strong>
                </div>
              ))}
            </section>
          )}
          {note && (
            <p className={styles.priceListNote}>
              {copy.priceNoteLabel && <strong>{copy.priceNoteLabel}</strong>} {note}
            </p>
          )}
        </section>

        {(shop.whatsapp() || shop.phone) && (
          <section className={styles.cta}>
            <h2 className={styles.sectionTitle}>{copy.servicesCtaTitle}</h2>
            {copy.servicesCtaText && (
              <p className={`${styles.lead} ${styles.muted} ${styles.ctaText}`}>
                {copy.servicesCtaText}
              </p>
            )}
            <div className={styles.ctaActions}>
              <ContactButtons shop={shop} chatLabel={copy.whatsappCta} callWithNumber />
            </div>
          </section>
        )}
      </main>
    </SubpageShell>
  );
}

export function describe(context: TemplateContext) {
  const services = context.store.services;
  return {
    title: services?.title ?? "Services",
    description: services?.intro,
  };
}
