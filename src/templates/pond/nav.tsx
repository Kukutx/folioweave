import Link from "next/link";
import type { Ref } from "react";
import type { NavItem, NavKey, PondLabels } from "./data";
import { ThemeToggle } from "./theme-toggle";
import s from "./pond.module.css";

/** pond / projects / gallery / blog / light: the current page in the full ink, the others muted. */
export function Nav({
  items,
  current,
  labels,
  navRef,
}: {
  items: NavItem[];
  current?: NavKey;
  labels: PondLabels;
  navRef?: Ref<HTMLElement>;
}) {
  return (
    <nav className={s.nav} ref={navRef}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`${s.navItem} ${item.key === current ? s.active : ""}`}
          aria-current={item.key === current ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
      <ThemeToggle className={`${s.navItem} ${s.toggle}`} light={labels.light} dark={labels.dark} />
    </nav>
  );
}
