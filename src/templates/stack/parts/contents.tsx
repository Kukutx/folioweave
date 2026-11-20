import Link from "next/link";
import type { ReactNode } from "react";
import type { Post } from "../data";
import k from "./contents.module.css";

/** A typed table of contents: each title, a dotted leader, then its date and reading time. */
export function Contents({ posts }: { posts: readonly Post[] }) {
  return (
    <ol className={k.list}>
      {posts.map((post) => (
        <li key={post.id}>
          <Link className={k.row} href={post.href}>
            <span className={k.title}>{post.title}</span>
            <span className={k.leader} aria-hidden="true" />
            <span className={k.meta}>
              <time dateTime={post.datetime}>{post.date}</time>
              <span aria-hidden="true"> · </span>
              <span>{post.minutes}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** The sheet the contents are typed on, with two more under it. */
export function Sheet({
  heading,
  description,
  label,
  as: Heading = "h3",
  children,
  land = true,
}: {
  heading: string;
  description?: string | null;
  label?: string;
  as?: "h1" | "h3";
  children: ReactNode;
  land?: boolean;
}) {
  return (
    <div className={k.sheet} data-land={land ? "" : undefined}>
      {label && <p className={k.kicker}>{label}</p>}
      <Heading className={k.heading}>{heading}</Heading>
      {description && <p className={k.description}>{description}</p>}
      {children}
    </div>
  );
}
