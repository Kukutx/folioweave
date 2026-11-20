import type { ReactNode } from "react";
import type { TemplateContext } from "@/core/contracts";
import { pondLabels, pondNav, type NavKey } from "./data";
import { Nav } from "./nav";
import s from "./pond.module.css";

/** Every page but the pond: the same navigation at the top, then the intro's 640 px column on plain paper. */
export function Shell({
  context,
  current,
  children,
}: {
  context: TemplateContext;
  current?: NavKey;
  children: ReactNode;
}) {
  return (
    <div className={s.sub}>
      <header className={s.header}>
        <Nav items={pondNav(context)} current={current} labels={pondLabels(context)} />
      </header>
      <main id="main" className={s.column}>
        {children}
      </main>
    </div>
  );
}
