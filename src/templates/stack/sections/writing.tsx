import Link from "next/link";
import type { StackData } from "../data";
import { Contents, Sheet } from "../parts/contents";
import { Divider } from "../parts/divider";
import { ArrowRight } from "../parts/icons";
import s from "../stack.module.css";
import w from "./writing.module.css";

/** Writing: the latest articles typed as a table of contents. */
export function Writing({ data, slot }: { data: StackData; slot: number }) {
  const { writing, labels, tabs } = data;
  return (
    <section id="writing" className={s.section} aria-labelledby="writing-title">
      <Divider
        slot={slot}
        slots={tabs.length}
        tint="writing"
        id="writing-title"
      >
        {labels.writing}
      </Divider>
      <Sheet heading={writing.heading} description={writing.description}>
        <Contents posts={writing.posts} />
        <p className={w.more}>
          <Link href="/blogs" className={s.button}>
            {labels.allWriting}
            <ArrowRight />
          </Link>
        </p>
      </Sheet>
    </section>
  );
}
