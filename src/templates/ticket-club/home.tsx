import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { getBlogIndexPosts } from "@/blog";
import {
  billOf,
  dateOf,
  fill,
  labelsOf,
  letterOf,
  programmeOf,
  ticketsOf,
} from "./data";
import { emWidth } from "./ticket";
import { Opening } from "./opening";
import { Strip } from "./strip";
import { Letter } from "./letter";
import { Listing } from "./listing";
import s from "./site.module.css";
import b from "./bill.module.css";

/** One page: the bill with the roll of tickets, the letter, the programme and the latest writing. */
const Home: TemplateModule["Home"] = ({ context }) => {
  const labels = labelsOf(context);
  const bill = billOf(context);
  const letter = letterOf(context);
  const programme = programmeOf(context);
  const locale = context.site.identity.locale;
  const posts = context.capabilities.writing
    ? getBlogIndexPosts().slice(0, 3)
    : [];
  const nameEm = Math.max(...bill.name.split(/\s+/).map(emWidth)).toFixed(2);
  let number = 1;
  const no = () => `No. ${String(++number).padStart(2, "0")}`;
  return (
    <main id="main" className={s.main}>
      <section className={b.bill} aria-labelledby="tc-name">
        <Opening className={b.inner}>
          <div className={b.copy}>
            {(bill.role || bill.place) && (
              <p className={`${s.mono} ${b.role}`}>
                {bill.role}
                {bill.place && <span>{bill.place}</span>}
              </p>
            )}
            <h1
              id="tc-name"
              className={b.name}
              style={{ ["--name-em" as string]: nameEm }}
            >
              {bill.name}
            </h1>
            {bill.summary && <p className={b.summary}>{bill.summary}</p>}
          </div>
          <div className={b.hang} id="tickets">
            <h2 className={s.hidden}>{labels.tickets}</h2>
            <Strip
              tickets={ticketsOf(context)}
              issuedBy={fill(labels.issuedBy, { name: bill.name })}
              labels={{
                hintIdle: labels.hintIdle,
                copyFailed: labels.copyFailed,
                pull: labels.pull,
                taken: labels.taken,
                again: labels.again,
                stubAction: labels.stubAction,
              }}
            />
          </div>
        </Opening>
      </section>

      {letter && (
        <section id="letter" className={s.section} aria-labelledby="tc-letter">
          <header className={s.head}>
            <p className={`${s.mono} ${s.kicker}`}>{no()}</p>
            <h2 id="tc-letter" className={s.heading}>
              {labels.letter}
            </h2>
          </header>
          <Letter letter={letter} />
        </section>
      )}

      {programme.length > 0 && (
        <section
          id="programme"
          className={s.section}
          aria-labelledby="tc-programme"
        >
          <header className={s.head}>
            <p className={`${s.mono} ${s.kicker}`}>{no()}</p>
            <h2 id="tc-programme" className={s.heading}>
              {labels.programme}
            </h2>
          </header>
          <Listing
            kind="work"
            rows={programme.map((p, i) => ({
              key: p.id,
              num: String(i + 1).padStart(2, "0"),
              title: p.name,
              href: p.href,
              external: p.external,
              text: p.description,
              meta: p.date,
            }))}
          />
        </section>
      )}

      {posts.length > 0 && (
        <section
          id="writing"
          className={s.section}
          aria-labelledby="tc-writing"
        >
          <header className={s.head}>
            <p className={`${s.mono} ${s.kicker}`}>{no()}</p>
            <h2 id="tc-writing" className={s.heading}>
              {context.writing.heading || labels.writing}
            </h2>
            <Link href="/blogs" className={`${s.mono} ${s.more}`}>
              {labels.allWriting} <span aria-hidden>→</span>
            </Link>
          </header>
          <Listing
            kind="posts"
            rows={posts.map((post) => ({
              key: post.slug,
              num: post.displayDate ?? dateOf(post.date, locale),
              dateTime: post.date.slice(0, 10),
              title: post.title,
              href: post.href,
              text: post.subtitle ?? post.description,
              meta: `${post.readingMinutes} ${labels.minutes}`,
            }))}
          />
        </section>
      )}
    </main>
  );
};
export default Home;
