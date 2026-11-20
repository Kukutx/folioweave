import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { stackLabels } from "./data";
import { Shell } from "./blog";
import { ArrowLeft } from "./parts/icons";
import s from "./stack.module.css";
import b from "./blog.module.css";

/** A blank index card, stamped. */
const NotFound: NonNullable<TemplateModule["NotFound"]> = ({ context }) => {
  const labels = stackLabels(context);
  return (
    <Shell context={context}>
      <div className={b.missing}>
        <div className={b.missingHead}>
          <span className={b.missingCode}>404</span>
        </div>
        <h1 className={b.missingTitle}>{labels.notFoundTitle}</h1>
        <p className={b.missingText}>{labels.notFoundText}</p>
      </div>
      <p className={b.back}>
        <Link href="/" className={s.button}>
          <ArrowLeft />
          {labels.home}
        </Link>
      </p>
    </Shell>
  );
};
export default NotFound;
