"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

const settle = {
  type: "spring" as const,
  stiffness: 140,
  damping: 20,
  mass: 0.7,
};

export function WordReveal({
  children,
  className = "",
  delay = 0,
  color,
  style,
  trigger,
}: {
  children: string;
  className?: string;
  delay?: number;
  color?: string;
  style?: CSSProperties;
  trigger?: boolean;
}) {
  const words = children.split(" ");
  const viewProps =
    typeof trigger === "boolean"
      ? { animate: trigger ? "visible" : "hidden" }
      : { whileInView: "visible", viewport: { once: false, margin: "-10%" } };
  return (
    <motion.span
      style={{
        overflow: "hidden",
        display: "inline-block",
        width: "fit-content",
        color,
        paddingBottom: "0.15em",
        marginBottom: "-0.15em",
        verticalAlign: "bottom",
        ...style,
      }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.08, delayChildren: 0.04 + delay },
        },
      }}
      initial="hidden"
      {...viewProps}
      className={className}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          variants={{
            visible: { opacity: 1, y: 0, transition: settle },
            hidden: { opacity: 0, y: 20, transition: settle },
          }}
          style={{ marginRight: "0.25em", display: "inline-block" }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

export function CharReveal({
  children,
  className = "",
  delay = 0,
  trigger,
}: {
  children: string;
  className?: string;
  delay?: number;
  trigger?: boolean;
}) {
  const chars = Array.from(children);
  const viewProps =
    typeof trigger === "boolean"
      ? { animate: trigger ? "visible" : "hidden" }
      : { whileInView: "visible", viewport: { once: false, margin: "-10%" } };
  return (
    <motion.span
      style={{
        overflow: "hidden",
        display: "inline-block",
        paddingBottom: "0.15em",
        marginBottom: "-0.15em",
        verticalAlign: "bottom",
      }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.045, delayChildren: 0.04 + delay },
        },
      }}
      initial="hidden"
      {...viewProps}
      className={className}
    >
      {chars.map((char, index) => (
        <motion.span
          key={index}
          variants={{
            visible: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: settle,
            },
            hidden: {
              opacity: 0,
              y: 24,
              filter: "blur(10px)",
              transition: settle,
            },
          }}
          style={{ display: "inline-block", whiteSpace: "pre" }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

export function FadeIn({
  children,
  className,
  delay = 0,
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
