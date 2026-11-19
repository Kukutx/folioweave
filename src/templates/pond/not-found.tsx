import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { pondLabels } from "./data";
import { Shell } from "./shell";
import s from "./pond.module.css";

const NotFound: NonNullable<TemplateModule["NotFound"]> = ({ context }) => {
  const labels = pondLabels(context);
  return (
    <Shell context={context}>
      <p className={`${s.muted} ${s.small}`}>404</p>
      <h1 className={s.title}>{labels.notFound}</h1>
      <p className={s.back}>
        <Link className={s.link} href="/">
          {labels.back}
        </Link>
      </p>
    </Shell>
  );
};
export default NotFound;
