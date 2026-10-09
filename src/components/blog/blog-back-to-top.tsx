"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { scrollToPosition } from "@/lib/scroll";
import styles from "./blog-tools.module.css";

export function BlogBackToTop({ locale }: { locale: string }) {
  const [visible, setVisible] = useState(false);
  const current = useRef(false);
  useEffect(() => {
    const update = () => {
      const next = window.scrollY > Math.max(420, window.innerHeight * 0.72);
      if (next === current.current) return;
      current.current = next;
      setVisible(next);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  const label = /^zh(?:-|$)/i.test(locale) ? "回到顶部" : "Back to top";
  return (
    visible && (
      <button
        type="button"
        className={`${styles.action} ${styles.iconOnly} ${styles.enter}`}
        data-blog-back-to-top
        aria-label={label}
        title={label}
        onClick={() => scrollToPosition(0, { duration: 0.9, force: true })}
      >
        <ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
    )
  );
}
