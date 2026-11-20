import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { pondLabels } from "./data";
import { Bar } from "./bar";
import { Still } from "./water/still";
import { Water } from "./water/water";
import s from "./pond.module.css";

// Open water where the page should be: one koi stayed behind.
const NotFound: NonNullable<TemplateModule["NotFound"]> = ({ context }) => {
  const labels = pondLabels(context);
  return (
    <div className={`${s.lost} ${s.onWater}`} data-pond-page="">
      <Bar context={context} />
      <main id="main" className={s.lostText} data-pond-avoid="">
        <p className={s.kicker}>404</p>
        <h1 className={s.greeting}>{labels.notFound}</h1>
        <p className={s.back}>
          <Link className={s.link} href="/">
            {labels.back}
          </Link>
        </p>
      </main>
      <Water label={labels.pond} className={s.pond}>
        <Still scene="lost" seeds={[]} id="lost" />
      </Water>
    </div>
  );
};
export default NotFound;
