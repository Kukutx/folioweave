"use client";

import { useEffect, useState, type RefObject } from "react";

export function useViewportActivity(
  ref: RefObject<Element | null>,
  rootMargin = "240px 0px",
) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let intersecting = false;
    const sync = () => setActive(intersecting && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry?.isIntersecting ?? false;
        sync();
      },
      { rootMargin },
    );
    const onVisibilityChange = () => sync();

    observer.observe(element);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ref, rootMargin]);

  return active;
}
