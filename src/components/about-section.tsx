"use client";

import { motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { aboutStory, aboutTimeline } from "@/content/about";
import { storyGalleryImages } from "@/content/media";
import { mobileViewportQuery, useMediaQuery } from "@/hooks/use-media-query";
import { scrollToElement } from "@/lib/scroll";
import { CharReveal } from "./motion-text";
import { InstaxCamera, PhotoCard } from "./media-interactions";

type AboutView = "normal" | "bullets" | "timeline";

const easeOut = [0.22, 1, 0.36, 1] as const;
const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};
const childVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: easeOut },
  },
};

function AlignLeftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-align-left"
    >
      <line x1="21" x2="3" y1="6" y2="6" />
      <line x1="15" x2="3" y1="12" y2="12" />
      <line x1="17" x2="3" y1="18" y2="18" />
    </svg>
  );
}

function ListIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-list"
    >
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-calendar"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

const toggleItems: Array<{
  id: AboutView;
  label: string;
  icon: (props: { size?: number }) => ReactNode;
}> = [
  { id: "normal", label: "Story", icon: AlignLeftIcon },
  { id: "bullets", label: "TL;DR", icon: ListIcon },
  { id: "timeline", label: "Timeline", icon: CalendarIcon },
];

function Toggle({
  value,
  onChange,
  mobile,
}: {
  value: AboutView;
  onChange: (value: AboutView) => void;
  mobile: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<AboutView, HTMLButtonElement | null>>({
    normal: null,
    bullets: null,
    timeline: null,
  });
  const [indicator, setIndicator] = useState({ x: 0, width: 0 });

  const measure = useCallback(() => {
    const button = buttonRefs.current[value];
    const container = containerRef.current;
    if (!button || !container) return;
    const buttonRect = button.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setIndicator({
      x: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    });
  }, [value]);

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    Object.values(buttonRefs.current).forEach((button) => {
      if (button) observer.observe(button);
    });
    return () => observer.disconnect();
  }, [mobile, measure]);

  return (
    <div
      ref={containerRef}
      className="about-toggle-container profile-inline-toggle"
      aria-label="About view"
    >
      <motion.span
        className="about-toggle-indicator"
        animate={indicator}
        transition={{
          type: "spring",
          stiffness: 420,
          damping: 34,
          mass: 0.7,
        }}
      />
      {toggleItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          ref={(element) => {
            buttonRefs.current[id] = element;
          }}
          onClick={() => onChange(id)}
          className={`about-toggle-btn ${value === id ? "active" : ""}`}
          type="button"
        >
          <span className="about-toggle-icon" aria-hidden>
            <Icon size={18} />
          </span>
          <span>{mobile && id === "normal" ? "Bio" : label}</span>
        </button>
      ))}
    </div>
  );
}

function StoryMuted({
  tldr,
  children,
}: {
  tldr: boolean;
  children: ReactNode;
}) {
  return (
    <span
      style={{
        opacity: tldr ? 0.25 : 1,
        textDecoration: tldr ? "line-through" : "none",
        color: "inherit",
      }}
    >
      {children}
    </span>
  );
}

function StoryStrong({
  tldr,
  children,
}: {
  tldr: boolean;
  children: ReactNode;
}) {
  return (
    <span style={{ opacity: 1, color: tldr ? "#111" : "inherit" }}>
      {children}
    </span>
  );
}

function StoryHighlight({
  tldr,
  children,
}: {
  tldr: boolean;
  children: ReactNode;
}) {
  return <span className={tldr ? "" : "highlight-yellow"}>{children}</span>;
}

function Story({ tldr }: { tldr: boolean }) {
  return (
    <div className={`story-content ${tldr ? "is-tldr" : ""}`}>
      {aboutStory.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>
          {paragraph.map((segment, segmentIndex) => {
            const key = `${paragraphIndex}-${segmentIndex}`;
            if (segment.tone === "muted") {
              return (
                <StoryMuted key={key} tldr={tldr}>
                  {segment.text}
                </StoryMuted>
              );
            }
            if (segment.tone === "highlight") {
              return (
                <StoryHighlight key={key} tldr={tldr}>
                  {segment.text}
                </StoryHighlight>
              );
            }
            return (
              <StoryStrong key={key} tldr={tldr}>
                {segment.text}
              </StoryStrong>
            );
          })}
        </p>
      ))}
    </div>
  );
}
function ModernTimeline() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="profile-timeline"
    >
      {aboutTimeline.map((item, index) => (
        <motion.div
          key={item.year}
          className={`profile-timeline-item ${item.year === "2026" ? "is-current" : ""}`}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.24,
            delay: index * 0.055,
            ease: easeOut,
          }}
        >
          <span>{item.year}</span>
          <div>
            <h4>{item.title}</h4>
            <p>{item.desc}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function AboutSection() {
  const [view, setView] = useState<AboutView>("normal");
  const mobile = useMediaQuery(mobileViewportQuery, { debounceMs: 150 });
  const sectionRef = useRef<HTMLElement>(null);
  const initializedView = useRef(false);


  useEffect(() => {
    if (!initializedView.current) {
      initializedView.current = true;
      return;
    }
    const section = sectionRef.current;
    if (!section) return;
    scrollToElement(section, { offset: -100, duration: 1.2 });
  }, [view]);

  return (
    <motion.section
      ref={sectionRef}
      id="about"
      className="profile-about-section"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-15%" }}
    >
      <div className="profile-about-section-inner">
        <div className="profile-about-section-header">
          <h2 className="section-label">
            <CharReveal>About</CharReveal>
          </h2>
          <Toggle value={view} onChange={setView} mobile={mobile} />
        </div>
        <div
          className={`profile-about-content${view === "bullets" ? " is-tldr" : ""}`}
        >
          {view === "timeline" ? (
            <ModernTimeline />
          ) : (
            <Story tldr={view === "bullets"} />
          )}
        </div>
      </div>

      <motion.div
        variants={childVariant}
        className="story-gallery"
        aria-label="Personal photos"
      >
        {storyGalleryImages.map((src, index) => {
          const styles = [
            [-6, 10],
            [5, -15],
            [7, 20],
            [-5, -5],
          ][index];
          return (
            <div
              key={src}
              className="story-photo-wrapper"
              style={{
                transform: `rotate(${styles[0]}deg) translateY(${styles[1]}px)`,
              }}
            >
              <PhotoCard src={src} index={index} isPolaroid />
            </div>
          );
        })}
      </motion.div>

      <motion.div variants={childVariant} className="life-camera-section">
        <InstaxCamera
          onPrint={() =>
            window.scrollTo({ top: window.scrollY + 420, behavior: "smooth" })
          }
        />
      </motion.div>
    </motion.section>
  );
}
