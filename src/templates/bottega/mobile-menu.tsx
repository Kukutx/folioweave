"use client";

import { useEffect, useState } from "react";
import styles from "./bottega.module.css";

type NavItem = { href: string; label: string };

// The only interactive part of the home page; everything else is static HTML.
export function MobileMenu({
  items,
  openLabel,
  closeLabel,
  navLabel,
}: {
  items: NavItem[];
  openLabel: string;
  closeLabel: string;
  navLabel: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.menuButton}
        aria-controls="bottega-mobile-menu"
        aria-expanded={open}
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen(!open)}
      >
        {open ? "×" : "☰"}
      </button>
      {open && (
        <nav
          id="bottega-mobile-menu"
          className={styles.mobileMenu}
          aria-label={navLabel}
        >
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={styles.mobileLink}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
