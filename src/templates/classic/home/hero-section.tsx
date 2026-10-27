"use client";

import { AnimatePresence, motion } from "framer-motion";
import { getImageProps } from "next/image";
import {
  Fragment,
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useMotionActivity } from "@/hooks/use-motion-activity";
import { useOpening } from "@/hooks/use-opening";
import { AboutSection } from "../about-section";
import { ScrollHint } from "./scroll-hint";
import { CharReveal } from "@/components/motion-text";
import { ResumePrinter, type ResumeState } from "@/components/media/resume-printer";
import { homeContent } from "@/content/home";
import { workProjects } from "@/content/work";
import { scrollToElement } from "@/lib/scroll";
import { portraitImages } from "@/content/media";
import { useMobileViewport } from "@/hooks/use-media-query";
import { mailto, siteConfig } from "@/config/site";
import { mediaDimensions } from "@/portfolio/media";
import type { PortfolioRichTextSegment } from "@/portfolio/schema";

const greetings = homeContent.greetings;
const portraitSizes = "(max-width: 767px) 260px, 340px";
function portraitProps(index: number) {
  const src = portraitImages[index];
  const { props } = getImageProps({
    src,
    alt: siteConfig.identity.name,
    ...mediaDimensions(src),
    sizes: portraitSizes,
  });
  return {
    src: props.src,
    srcSet: props.srcSet,
    sizes: props.sizes,
    width: props.width,
    height: props.height,
  };
}
// Small, frequently changing islands must not rerender the whole Hero/About tree.
const StableAboutSection = memo(AboutSection);
const GreetingCycle = memo(function GreetingCycle({
  active,
  reducedMotion,
}: {
  active: boolean;
  reducedMotion: boolean;
}) {
  const [greet, setGreet] = useState(0);
  useEffect(() => {
    if (!active || reducedMotion || greetings.length < 2) return;
    const id = window.setInterval(
      () => setGreet((value) => (value + 1) % greetings.length),
      2000,
    );
    return () => window.clearInterval(id);
  }, [active, reducedMotion]);
  return (
    <span
      className="hero-greeting"
      style={{
        fontFamily: "var(--font-serif)",
        fontWeight: 400,
        fontStyle: "italic",
        display: "block",
        minHeight: "1.2em",
        marginBottom: "-.1em",
        color: "rgba(0,0,0,.75)",
      }}
    >
      {reducedMotion ? (
        <span style={{ display: "inline-block" }}>{greetings[0]},</span>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={greet}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            style={{ display: "inline-block" }}
          >
            {greetings[greet]},
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  );
});

const PortraitImage = memo(function PortraitImage({
  active,
  index,
}: {
  active: boolean;
  index: number;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <AnimatePresence>
        {active && !loaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, #e5e5e5 0%, #f0f0f0 50%, #e5e5e5 100%)",
              backgroundSize: "200% 100%",
              animation: "classic-portrait-shimmer 1.5s linear infinite",
              zIndex: 10,
            }}
          />
        )}
      </AnimatePresence>
      <motion.img
        {...portraitProps(index)}
        ref={(image) => {
          if (image?.complete && image.naturalWidth > 0) setLoaded(true);
        }}
        alt={siteConfig.identity.name}
        className="polaroid-photo-image"
        draggable={false}
        loading="eager"
        decoding="async"
        fetchPriority={index === 0 ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        initial={{
          opacity: 0,
          scale: 1.035,
          filter: "brightness(1.12)",
        }}
        animate={{
          opacity: 1,
          scale: 1,
          filter: "brightness(1)",
        }}
        exit={{
          opacity: 0,
          scale: 0.985,
          filter: "brightness(1.06)",
        }}
        transition={{
          duration: 0.34,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
        }}
      />
    </>
  );
});

function projectAnchor(id: string | undefined) {
  if (!id || !siteConfig.features.work) return null;
  return workProjects.some((project) => project.id === id) ? `work-${id}` : null;
}

function goToProject(event: React.MouseEvent<HTMLAnchorElement>, anchor: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
    return;
  const target = document.getElementById(anchor);
  if (!target) return;
  event.preventDefault();
  const nav = document.querySelector<HTMLElement>(".nav");
  const offset = nav ? nav.getBoundingClientRect().bottom + 24 : 98;
  window.history.pushState(null, "", `#${anchor}`);
  scrollToElement(target, { offset: -offset, duration: 1.2, force: true });
}

function RichText({
  segments,
}: {
  segments: readonly PortfolioRichTextSegment[];
}) {
  return segments.map((segment, index) => {
    if ("text" in segment) return <Fragment key={index}>{segment.text}</Fragment>;
    const key = `${segment.brand.name}-${index}`;
    const content = (
      <>
        <img src={segment.brand.icon} alt={segment.brand.name} />{" "}
        {segment.brand.name}
      </>
    );
    const anchor = projectAnchor(segment.brand.project);
    return anchor ? (
      <a
        className="hero-brand-inline"
        key={key}
        href={`#${anchor}`}
        onClick={(event) => goToProject(event, anchor)}
      >
        {content}
      </a>
    ) : (
      <span className="hero-brand-inline" key={key}>
        {content}
      </span>
    );
  });
}

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const { active, reducedMotion } = useMotionActivity(heroRef);
  const [opening] = useOpening(heroRef, "hero-intro-");
  const mobile = useMobileViewport(),
    [portrait, setPortrait] = useState(0),
    // The white flash marks a change of portrait, so the first one has none.
    [portraitChanges, setPortraitChanges] = useState(0),
    [mobileTilt, setMobileTilt] = useState({ x: 0, y: 0 }),
    [resume, setResume] = useState<ResumeState>("idle");
  useEffect(() => {
    if (!active || !mobile || !("DeviceOrientationEvent" in window)) return;
    let frame = 0;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const beta = event.beta ?? 0;
        const gamma = event.gamma ?? 0;
        setMobileTilt({
          x: Math.max(-4, Math.min(4, beta / 18)),
          y: Math.max(-4, Math.min(4, gamma / 12)),
        });
        frame = 0;
      });
    };

    // Do not request sensor permissions implicitly for decorative motion.
    window.addEventListener("deviceorientation", onOrientation, {
      passive: true,
    });
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [active, mobile]);
  const next = () => {
    setPortrait((v) => (v + 1) % portraitImages.length);
    setPortraitChanges((count) => count + 1);
  };
  return (
    <section
      ref={heroRef}
      id="home"
      className="hero-section"
      data-opening={opening ? "" : undefined}
      style={{ "--mouse-x": "50%", "--mouse-y": "50%" } as CSSProperties}
    >
      <ScrollHint blocked={resume !== "idle"} />
      <div className="container">
        <div
          className={`hero-wrapper ${resume !== "idle" && resume !== "collapsing" && resume !== "morphing" ? "is-resume-active" : ""}`}
        >
          {/* The opening (content and greeting rising, name, bio, portrait)
              is CSS in hero.css, so it plays from the first paint and the
              server HTML is the final state. */}
          <div className="hero-content">
            <div className="hero-grid">
              <div className="hero-text-side">
                <h1 className="hero-title">
                  <GreetingCycle
                    active={active}
                    reducedMotion={reducedMotion}
                  />
                  <CharReveal delay={0.35} intro className="hero-main-text">
                    {`I'm ${siteConfig.identity.name}`}
                  </CharReveal>{" "}
                  <span className="hero-wave" aria-hidden>
                    👋
                  </span>
                </h1>
                <div className="hero-bio">
                  <p className="hero-role-line">
                    <RichText segments={homeContent.hero.roleLine} />
                  </p>
                  <p className="hero-summary">
                    <RichText segments={homeContent.hero.summary} />
                  </p>
                </div>
                <div id="profile-actions">
                  <div
                    className={`profile-action-row ${resume !== "idle" && resume !== "collapsing" ? "is-resume-active" : ""}`}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {(resume === "idle" || resume === "collapsing") && (
                        <motion.a
                          layout
                          className="say-hi-button"
                          href={mailto(
                            siteConfig.contact.email,
                            siteConfig.contact.hiSubject,
                          )}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={
                            reducedMotion
                              ? { duration: 0.01 }
                              : {
                                  duration: 0.32,
                                  ease: [0.22, 1, 0.36, 1],
                                }
                          }
                        >
                          Say hi <span aria-hidden>👋</span>
                        </motion.a>
                      )}
                    </AnimatePresence>
                    {siteConfig.resume.enabled && (
                      <ResumePrinter state={resume} setState={setResume} />
                    )}
                  </div>
                </div>
              </div>
              <div className="hero-image-side" style={{ position: "relative" }}>
                <motion.div
                  className="card-polaroid"
                  role="button"
                  tabIndex={0}
                  aria-label={`Show next portrait. Photo ${portrait + 1} of ${portraitImages.length}.`}
                  initial={false}
                  animate={{ opacity: 1, scale: 1, rotate: 6, y: 0 }}
                  // As on the original site, hover and its return settle
                  // after a short pause, so a pointer passing by leaves the
                  // card alone.
                  transition={{
                    type: "spring",
                    stiffness: 140,
                    damping: 20,
                    mass: 0.7,
                    delay: 0.5,
                  }}
                  drag={!mobile}
                  dragMomentum={false}
                  onTap={next}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      next();
                    }
                  }}
                  whileHover={mobile ? undefined : { y: -4, rotate: 4 }}
                  whileTap={{ scale: 0.98 }}
                  whileDrag={{
                    scale: 1.1,
                    rotate: 6,
                    zIndex: 100,
                    cursor: "grabbing",
                  }}
                  style={{
                    position: "relative",
                    transformOrigin: "center",
                    willChange: "transform",
                    rotateX: mobile && active ? mobileTilt.x : 0,
                    rotateY: mobile && active ? mobileTilt.y : 0,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div
                    className="polaroid-img"
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      background: "#e5e5e5",
                    }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <PortraitImage key={portrait} active={active} index={portrait} />
                    </AnimatePresence>
                    {portraitChanges > 0 && (
                      <motion.div
                        key={`flash-${portraitChanges}`}
                        aria-hidden
                        initial={{ opacity: 0.32 }}
                        animate={{ opacity: 0 }}
                        transition={{
                          duration: 0.38,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "#fff",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                  </div>
                  <span>{`me_0${portrait + 1}.jpeg`}</span>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
        {siteConfig.features.about && <StableAboutSection />}
      </div>
    </section>
  );
}
