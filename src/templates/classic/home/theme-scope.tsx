"use client";

import { motion, useMotionValue, type MotionValue } from "framer-motion";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { useViewportActivity } from "@/hooks/use-viewport-activity";

export const HomeForeground = createContext<MotionValue<string> | null>(null);

/** Keep animated inheritance within the content that can currently be seen. */
export function ThemeScope({ children }: { children: ReactNode }) {
  const theme = useContext(HomeForeground);
  if (!theme) throw new Error("ThemeScope requires HomeForeground");
  const ref = useRef<HTMLDivElement>(null);
  const active = useViewportActivity(ref);
  const color = useMotionValue("#111111");
  useLayoutEffect(() => {
    if (!active) return;
    const update = () => color.set(theme.get());
    update();
    return theme.on("change", update);
  }, [active, color, theme]);
  return (
    <motion.div ref={ref} data-theme-scope style={{ color }}>
      {children}
    </motion.div>
  );
}
