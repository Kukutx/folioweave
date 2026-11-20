import Link from "next/link";
import type { TemplateContext } from "@/core/contracts";
import { pondLabels, pondNav, siteName, type NavKey } from "./data";
import { ThemeSwitch } from "./theme-switch";
import s from "./pond.module.css";

/** The bar over the water on every page: the name (home), the pages, and the time of day. */
export function Bar({ context, current }: { context: TemplateContext; current?: NavKey }) {
  const labels = pondLabels(context);
  const items = pondNav(context);
  return (
    <header className={`${s.bar} ${s.onWater}`}>
      <Link className={s.mark} href="/" aria-current={current === "home" ? "page" : undefined} data-pond-avoid="">
        {siteName(context)}
      </Link>
      {items.length > 0 && (
        <nav className={s.nav} data-pond-avoid="">
          {items.map((item) => (
            <Link
              key={item.key}
              className={s.navLink}
              href={item.href}
              aria-current={item.key === current ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      <ThemeSwitch
        className={s.switch}
        slashClassName={s.slash}
        light={labels.light}
        dark={labels.dark}
        label={labels.timeOfDay}
      />
    </header>
  );
}
