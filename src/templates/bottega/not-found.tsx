import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import styles from "./bottega.module.css";
import { Wordmark } from "./parts";
import { external, shopOf } from "./shop";

// The original's Italian 404, in the site's language.
const NotFound: NonNullable<TemplateModule["NotFound"]> = ({ context }) => {
  const shop = shopOf(context);
  const { copy } = shop;
  const whatsapp = shop.whatsapp();
  return (
    <main id="content" className={styles.notFound}>
      <Link
        href="/"
        className={styles.notFoundBrand}
        aria-label={`${shop.name} — ${copy.backToHomeLabel}`}
      >
        <Wordmark shop={shop} />
      </Link>
      <p className={styles.notFoundCode}>{copy.notFoundEyebrow}</p>
      <h1 className={styles.notFoundTitle}>{copy.notFoundTitle}</h1>
      {copy.notFoundText && (
        <p className={`${styles.lead} ${styles.notFoundText}`}>{copy.notFoundText}</p>
      )}
      <div className={styles.notFoundActions}>
        <Link href="/" className={styles.btnPrimaryLg}>
          {copy.notFoundHome}
        </Link>
        {whatsapp ? (
          <a href={whatsapp} {...external(whatsapp)} className={styles.btnOutlineLg}>
            {copy.whatsappCta}
          </a>
        ) : (
          shop.phone && (
            <a href={`tel:${shop.phone}`} className={styles.btnOutlineLg}>
              {copy.call} {shop.displayPhone}
            </a>
          )
        )}
      </div>
    </main>
  );
};
export default NotFound;
