import type { CSSProperties } from "react";
import type { StackData } from "../data";
import { imageSet } from "../parts/image";
import { Opening } from "../parts/opening";
import { Rich } from "../parts/rich";
import { Portraits } from "./portraits";
import s from "../stack.module.css";
import c from "./cover.module.css";

/** The top of the pile: the calling card with the name, the portraits clipped to its corner,
 * and behind it the dividers whose tabs lead to each section below. */
export function Cover({ data }: { data: StackData }) {
  const { cover, tabs, labels } = data;
  const prints = cover.portraits.map((picture) =>
    imageSet(picture, "(max-width: 720px) 132px, 240px"),
  );
  return (
    <Opening className={c.cover} id="top">
      {tabs.length > 0 && (
        <nav className={c.tabs} aria-label={labels.sections}>
          {tabs.map((tab, i) => (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              className={c.navTab}
              style={
                { "--tint": `var(--tint-${tab.id})`, "--i": i } as CSSProperties
              }
            >
              <span
                className={`${s.tabNumber} ${c.navNumber}`}
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {tab.label}
            </a>
          ))}
        </nav>
      )}
      <div
        className={c.card}
        data-portraits={prints.length > 0 ? "" : undefined}
      >
        {cover.place && (
          <p className={`${s.label} ${c.place}`}>{cover.place}</p>
        )}
        <h1 className={c.name}>{cover.name}</h1>
        {cover.roleLine.length > 0 && (
          <p className={c.role}>
            <Rich segments={cover.roleLine} />
          </p>
        )}
        {cover.summary.length > 0 && (
          <p className={c.summary}>
            <Rich segments={cover.summary} />
          </p>
        )}
        {prints.length > 0 && (
          <div className={c.corner}>
            <Portraits prints={prints} label={labels.nextPortrait} />
          </div>
        )}
      </div>
    </Opening>
  );
}
