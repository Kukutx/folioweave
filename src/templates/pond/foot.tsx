import Link from "next/link";
import type { TemplateContext } from "@/core/contracts";
import { pondLabels, pondNav, siteName, socialLinks } from "./data";
import s from "./pond.module.css";

/** The foot of the bank: the name, the way back to the pond and around the site, and the profile's links. */
export function Foot({ context }: { context: TemplateContext }) {
  const labels = pondLabels(context);
  const social = socialLinks(context);
  return (
    <footer className={s.foot}>
      <p className={s.footName}>{siteName(context)}</p>
      <div className={s.footLists}>
        <ul className={s.footList}>
          <li>
            <Link href="/">{labels.home}</Link>
          </li>
          {pondNav(context).map((item) => (
            <li key={item.key}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
        {social.length > 0 && (
          <ul className={s.footList}>
            {social.map((link) => (
              <li key={link.href}>
                <a href={link.href} {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                  {link.text}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
