import type { StackData } from "../data";
import { Divider } from "../parts/divider";
import { ArrowUpRight } from "../parts/icons";
import { imageSet } from "../parts/image";
import { tableLayouts } from "./prints-layout";
import { Table } from "./table";
import s from "../stack.module.css";
import t from "./prints.module.css";

/** Photography: the prints loose on the table, with the camera they were shot with. */
export function Prints({
  data,
  slot,
}: {
  data: NonNullable<StackData>;
  slot: number;
}) {
  const { photography, labels, tabs } = data;
  if (!photography) return null;
  const { large, small } = tableLayouts(
    photography.prints.map((print) => print.width / print.height),
  );
  const images = photography.prints.map((print) =>
    imageSet(print, "(max-width: 640px) 50vw, 340px"),
  );
  return (
    <section
      id="photography"
      className={s.section}
      aria-labelledby="photography-title"
    >
      <Divider
        slot={slot}
        slots={tabs.length}
        tint="photography"
        id="photography-title"
      >
        {labels.photography}
      </Divider>
      {photography.intro && <p className={t.intro}>{photography.intro}</p>}
      <div className={s.wide} data-land="">
        <Table
          images={images}
          large={large}
          small={small}
          labels={{ spread: labels.spread, gather: labels.gather }}
        >
          {photography.camera && (
            <span className={`${s.label} ${t.camera}`}>
              {photography.camera}
            </span>
          )}
          {photography.more && (
            <a
              className={`${s.ink} ${t.more}`}
              href={photography.more.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {photography.more.label}
              <ArrowUpRight />
            </a>
          )}
        </Table>
      </div>
    </section>
  );
}
