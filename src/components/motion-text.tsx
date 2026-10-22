"use client";

import { motion } from "framer-motion";
import { useRef, useState, type CSSProperties } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
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
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const ref = useRef<HTMLSpanElement>(null);
  // Text further down the page plays its reveal each time it scrolls in;
  // the server still renders it readable.
  const reveal = useViewReveal(ref, {
    once: false,
    rootMargin: "-10% 0px",
    disabled: typeof trigger === "boolean",
  });
  const viewProps = reducedMotion
    ? { animate: "visible" }
    : typeof trigger === "boolean"
      ? { animate: trigger ? "visible" : "hidden" }
      : { animate: reveal };
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
      {...viewProps}
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
 * Text whose characters rise out of a blur one after another.
 *
 * - Default: the characters play each time the text scrolls into view.
 * - `trigger`: they follow the boolean instead.
 * - `intro`: they play once as the page opens, for text that is on screen at
 *   load. The intro is CSS, so it starts with the first paint, and the markup
 *   is the same server and client.
 */
export function CharReveal({
  children,
  className = "",
  delay = 0,
  trigger,
  intro = false,
}: {
  children: string;
  className?: string;
  delay?: number;
  trigger?: boolean;
  intro?: boolean;
}) {
  const chars = Array.from(children);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const ref = useRef<HTMLSpanElement>(null);
  // Text further down the page plays its reveal each time it scrolls in;
  // the server still renders it readable.
  const reveal = useViewReveal(ref, {
    once: false,
    rootMargin: "-10% 0px",
    disabled: intro || typeof trigger === "boolean",
  });
  if (intro) {
    return <IntroChars chars={chars} className={className} delay={delay} />;
  }
  const viewProps = reducedMotion
    ? { animate: "visible" }
    : typeof trigger === "boolean"
      ? { animate: trigger ? "visible" : "hidden" }
      : { animate: reveal };
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
      {...viewProps}
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
  // The intro class goes once the last character has landed, or as soon as
  // the pointer arrives (a hover animates the characters itself). Later
  // animations on the characters then never bring the intro back.
  const [playing, setPlaying] = useState(true);
  const settled = (event: React.AnimationEvent<HTMLSpanElement>) => {
    if (event.target === event.currentTarget.lastElementChild) {
      setPlaying(false);
    }
  };
  return (
    <span
      className={playing ? `${className} ${styles.intro}` : className}
      style={{ ...lineStyle, "--intro-delay": `${delay}s` } as CSSProperties}
      onAnimationEnd={playing ? settled : undefined}
      onPointerEnter={playing ? () => setPlaying(false) : undefined}
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
