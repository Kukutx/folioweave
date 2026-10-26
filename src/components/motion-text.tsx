"use client";

import { motion } from "framer-motion";
import { useRef, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { useOpening } from "@/hooks/use-opening";
import { useViewReveal } from "@/hooks/use-view-reveal";
import styles from "./motion-text.module.css";

const settle = {
  type: "spring" as const,
  stiffness: 140,
  damping: 20,
  mass: 0.7,
};

const lineStyle: CSSProperties = {
  overflow: "hidden",
  display: "inline-block",
  paddingBottom: "0.15em",
  marginBottom: "-0.15em",
  verticalAlign: "bottom",
};
const charStyle: CSSProperties = { display: "inline-block", whiteSpace: "pre" };

// Text plays its reveal each time it scrolls into view; the server still
// renders it readable.
const textReveal = { once: false, rootMargin: "-10% 0px" };

/** Text whose words rise one after another as it scrolls into view. */
export function WordReveal({
  children,
  className = "",
  delay = 0,
  color,
  style,
}: {
  children: string;
  className?: string;
  delay?: number;
  color?: string;
  style?: CSSProperties;
}) {
  const words = children.split(" ");
  const reducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const reveal = useViewReveal(ref, textReveal);
  return (
    <motion.span
      style={{
        ...lineStyle,
        width: "fit-content",
        color,
        ...style,
      }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: reducedMotion ? 0 : 0.08,
            delayChildren: reducedMotion ? 0 : 0.04 + delay,
          },
        },
      }}
      initial={false}
      animate={reveal}
      ref={ref}
      className={className}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          variants={{
            visible: {
              opacity: 1,
              y: 0,
              transition: reducedMotion ? { duration: 0 } : settle,
            },
            hidden: {
              opacity: 0,
              y: 20,
              transition: reducedMotion ? { duration: 0 } : settle,
            },
          }}
          style={{ marginRight: "0.25em", display: "inline-block" }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

/**
 * Text whose characters rise out of a blur one after another, each time it
 * scrolls into view. With `intro` they play once as the page opens instead,
 * for text that is on screen at load: the intro is CSS, so it starts with the
 * first paint, and the markup is the same on the server and the client.
 */
export function CharReveal({
  children,
  className = "",
  delay = 0,
  intro = false,
}: {
  children: string;
  className?: string;
  delay?: number;
  intro?: boolean;
}) {
  const chars = Array.from(children);
  const reducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const reveal = useViewReveal(ref, { ...textReveal, disabled: intro });
  if (intro) {
    return <IntroChars chars={chars} className={className} delay={delay} />;
  }
  return (
    <motion.span
      style={lineStyle}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: reducedMotion ? 0 : 0.045,
            delayChildren: reducedMotion ? 0 : 0.04 + delay,
          },
        },
      }}
      initial={false}
      animate={reveal}
      ref={ref}
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
              transition: reducedMotion ? { duration: 0 } : settle,
            },
            hidden: {
              opacity: 0,
              y: 24,
              filter: "blur(10px)",
              transition: reducedMotion ? { duration: 0 } : settle,
            },
          }}
          style={charStyle}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

function IntroChars({
  chars,
  className,
  delay,
}: {
  chars: string[];
  className: string;
  delay: number;
}) {
  // The intro class goes once the characters have landed, or as soon as the
  // pointer arrives (a hover animates the characters itself).
  const ref = useRef<HTMLSpanElement>(null);
  const [playing, end] = useOpening(ref);
  return (
    <span
      ref={ref}
      className={playing ? `${className} ${styles.intro}` : className}
      style={{ ...lineStyle, "--intro-delay": `${delay}s` } as CSSProperties}
      onPointerEnter={playing ? end : undefined}
    >
      {chars.map((char, index) => (
        <span
          key={index}
          style={{ ...charStyle, "--char": index } as CSSProperties}
        >
          {char}
        </span>
      ))}
    </span>
  );
}
