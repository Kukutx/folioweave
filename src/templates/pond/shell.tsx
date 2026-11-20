import type { ReactNode } from "react";
import type { TemplateContext } from "@/core/contracts";
import { koiSeeds, pondLabels, type NavKey } from "./data";
import { Bar } from "./bar";
import { Foot } from "./foot";
import { Still } from "./water/still";
import { Water } from "./water/water";
import s from "./pond.module.css";

/** Every page but the pond itself: a band of the same water with the page's heading on it, then the bank. */
export function Shell({
  context,
  current,
  head,
  children,
}: {
  context: TemplateContext;
  current?: NavKey;
  /** what lies on the water: the page's title and the lines that introduce it */
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={s.page} data-pond-page="">
      <Bar context={context} current={current} />
      <main id="main">
        <div className={`${s.band} ${s.onWater}`}>
          <div className={s.bandText} data-pond-avoid="">
            {head}
          </div>
          <Water label={pondLabels(context).pond} className={s.pond}>
            <Still scene="band" seeds={koiSeeds(context)} id="band" />
          </Water>
        </div>
        <div className={s.bank}>{children}</div>
      </main>
      <Foot context={context} />
    </div>
  );
}

/** The usual heading on the water: an optional small line, the title, an optional introduction. */
export function Head({ kicker, title, lead }: { kicker?: ReactNode; title: ReactNode; lead?: ReactNode }) {
  return (
    <>
      {kicker && <p className={s.kicker}>{kicker}</p>}
      <h1 className={s.title}>{title}</h1>
      {lead && <p className={s.lead}>{lead}</p>}
    </>
  );
}
