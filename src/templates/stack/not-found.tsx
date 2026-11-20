import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { stackLabels } from "./data";
import { Shell } from "./blog";
import s from "./stack.module.css";
import b from "./blog.module.css";

const NotFound: NonNullable<TemplateModule["NotFound"]> = ({ context }) => {
  const labels = stackLabels(context);
  return (
    <Shell context={context}>
      <header className={b.head}>
        <p className={s.label}>404</p>
        <h1 className={b.title}>{labels.notFoundTitle}</h1>
        <p className={s.text}>{labels.notFoundText}</p>
      </header>
      <p className={b.back}>
        <Link href="/">← {labels.home}</Link>
      </p>
    </Shell>
  );
};
export default NotFound;
