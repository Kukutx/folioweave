import Image from "next/image";
import { notFound } from "next/navigation";
import type { TemplateContext } from "@/core/contracts";
import styles from "./bottega.module.css";
import { LocationStrip, SubpageShell } from "./parts";
import { external, shopOf } from "./shop";

/** Kinds of products, without prices or stock. Published only with a catalog. */
export default function CatalogPage({ context }: { context: TemplateContext }) {
  const catalog = context.store.catalog;
  if (!catalog) notFound();
  const shop = shopOf(context);
  const { copy } = shop;
  const ask = shop.whatsapp(copy.availabilityMessage);
  return (
    <SubpageShell context={context}>
      <main id="content">
        <section className={`${styles.container} ${styles.pageIntro}`}>
          <span className={styles.eyebrow}>{copy.catalogEyebrow}</span>
          <h1 className={styles.catalogTitle}>{catalog.title}</h1>
          {catalog.intro && (
            <p className={`${styles.lead} ${styles.pageLead}`}>{catalog.intro}</p>
          )}
        </section>

        <section
          className={`${styles.container} ${styles.pageSection}`}
          aria-labelledby="categories-heading"
        >
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>{copy.categoriesEyebrow}</p>
            <h2
              id="categories-heading"
              className={`${styles.sectionTitle} ${styles.sectionHeadTitle}`}
            >
              {copy.categoriesTitle}
            </h2>
            {copy.categoriesIntro && (
              <p className={`${styles.lead} ${styles.sectionHeadText}`}>
                {copy.categoriesIntro}
              </p>
            )}
          </div>
          <LocationStrip shop={shop} className={styles.catalogStrip} withAddress={false} page="catalog" />
          <div className={styles.categories}>
            {catalog.categories.map((category, index) => (
              <article key={`${index}-${category.name}`} className={styles.category}>
                {category.image && (
                  <div className={`${styles.media} ${styles.categoryImage}`}>
                    <Image
                      src={category.image}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  </div>
                )}
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <h3 className={styles.categoryName}>{category.name}</h3>
                {category.description && (
                  <p className={styles.categoryText}>{category.description}</p>
                )}
              </article>
            ))}
          </div>
          {catalog.note && <p className={styles.catalogNote}>{catalog.note}</p>}
        </section>

        {(ask || shop.phone) && (
          <section className={styles.cta}>
            <h2 className={styles.sectionTitle}>{copy.catalogCtaTitle}</h2>
            {copy.catalogCtaText && (
              <p className={`${styles.lead} ${styles.muted} ${styles.ctaText}`}>
                {copy.catalogCtaText}
              </p>
            )}
            <div className={styles.ctaActions}>
              {ask && (
                <a href={ask} {...external(ask)} className={styles.btnPrimaryLg}>
                  {copy.askAvailability}
                </a>
              )}
              {shop.phone && (
                <a
                  href={`tel:${shop.phone}`}
                  className={ask ? styles.btnOutlineLg : styles.btnPrimaryLg}
                >
                  {copy.call} {shop.displayPhone}
                </a>
              )}
            </div>
          </section>
        )}
      </main>
    </SubpageShell>
  );
}

export function describe(context: TemplateContext) {
  const catalog = context.store.catalog;
  return {
    title: catalog?.title ?? "Catalog",
    description: catalog?.intro,
  };
}
