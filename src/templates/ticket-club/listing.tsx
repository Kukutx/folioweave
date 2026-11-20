// The programme: projects and articles set as a printed running order, one line each, ruled by
// perforations. Server markup only.

import Link from "next/link";
import { Arrow } from "./ticket";
import l from "./listing.module.css";

export type Row = {
  key: string;
  /** the first column: a number for a project, the date for an article */
  num: string;
  dateTime?: string;
  title: string;
  href?: string;
  external?: boolean;
  text?: string;
  meta?: string;
};

export function Listing({
  rows,
  kind,
  level = 3,
}: {
  rows: Row[];
  kind: "work" | "posts";
  level?: 2 | 3;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <ol className={`${l.list} ${kind === "posts" ? l.posts : ""}`}>
      {rows.map((row) => (
        <li key={row.key} className={`${l.row} ${row.href ? l.linked : ""}`}>
          {row.dateTime ? (
            <time className={l.num} dateTime={row.dateTime}>
              {row.num}
            </time>
          ) : (
            <span className={l.num}>{row.num}</span>
          )}
          <div className={l.main}>
            <H className={l.title}>
              {row.href ? (
                row.external || !row.href.startsWith("/") ? (
                  <a
                    className={l.link}
                    href={row.href}
                    {...(row.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {row.title}
                  </a>
                ) : (
                  <Link className={l.link} href={row.href}>
                    {row.title}
                  </Link>
                )
              ) : (
                row.title
              )}
            </H>
            {row.text && <p className={l.text}>{row.text}</p>}
          </div>
          {row.meta && <span className={l.meta}>{row.meta}</span>}
          {row.href && (
            <span className={l.go} aria-hidden>
              <Arrow external={row.external} />
            </span>
          )}
          <span className={l.punch} aria-hidden />
        </li>
      ))}
    </ol>
  );
}
