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
import { AboutSection } from "../about-section";
import { CharReveal } from "../motion-text";
import { ResumePrinter, type ResumeState } from "../media/resume-printer";
import { homeContent } from "@/content/home";
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
// Greeting/portrait ticks must not rerender the independent About experience.
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

function RichText({
  segments,
}: {
  segments: readonly PortfolioRichTextSegment[];
}) {
  return segments.map((segment, index) =>
    "text" in segment ? (
      <Fragment key={index}>{segment.text}</Fragment>
    ) : (
      <span
        className="hero-brand-inline"
        key={`${segment.brand.name}-${index}`}
      >
        <img src={segment.brand.icon} alt={segment.brand.name} />{" "}
        {segment.brand.name}
      </span>
    ),
  );
}

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const { active, reducedMotion } = useMotionActivity(heroRef);
  const mobile = useMobileViewport(),
    [portrait, setPortrait] = useState(0),
    [loadedPortraits, setLoadedPortraits] = useState<Record<number, boolean>>(
      {},
    ),
    [mobileTilt, setMobileTilt] = useState({ x: 0, y: 0 }),
    [resume, setResume] = useState<ResumeState>("idle");
  useEffect(() => {
    // Prepare only the next interaction, after the current portrait has loaded.
    if (!active || !loadedPortraits[portrait] || portraitImages.length < 2)
      return;
    const index = (portrait + 1) % portraitImages.length;
    if (loadedPortraits[index]) return;
    let image: HTMLImageElement | undefined;
    const timer = window.setTimeout(() => {
      image = new Image();
      const markLoaded = () =>
        setLoadedPortraits((current) =>
          current[index] ? current : { ...current, [index]: true },
        );
      const next = portraitProps(index);
      image.onload = markLoaded;
      if (next.srcSet) image.srcset = next.srcSet;
      if (next.sizes) image.sizes = next.sizes;
      image.src = next.src;
      if (image.complete && image.naturalWidth > 0) markLoaded();
    }, 500);
    return () => {
      window.clearTimeout(timer);
      if (image) {
        image.onload = null;
        image.onerror = null;
      }
    };
  }, [active, loadedPortraits, portrait]);
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
  const next = () => setPortrait((v) => (v + 1) % portraitImages.length);
  return (
    <section
      ref={heroRef}
      id="home"
      className="hero-section"
      style={{ "--mouse-x": "50%", "--mouse-y": "50%" } as CSSProperties}
    >
      <div className="container">
        <div
          className={`hero-wrapper ${resume !== "idle" && resume !== "collapsing" && resume !== "morphing" ? "is-resume-active" : ""}`}
        >
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="hero-content"
          >
            <div className="hero-grid">
              <div className="hero-text-side">
                <h1 className="hero-title">
                  <GreetingCycle
                    active={active}
                    reducedMotion={reducedMotion}
                  />
                  <CharReveal delay={0.35} trigger className="hero-main-text">
                    {`I'm ${siteConfig.identity.name}`}
                  </CharReveal>{" "}
                  <span className="hero-wave" aria-hidden>
                    👋
                  </span>
                </h1>
                <motion.div
                  className="hero-bio"
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    delay: 0.75,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <p className="hero-role-line">
                    <RichText segments={homeContent.hero.roleLine} />
                  </p>
                  <p className="hero-summary">
                    <RichText segments={homeContent.hero.summary} />
                  </p>
                </motion.div>
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
                    <AnimatePresence>
                      {active && !loadedPortraits[portrait] && (
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
                            animation: "shimmer 1.5s infinite",
                            zIndex: 10,
                          }}
                        />
                      )}
                    </AnimatePresence>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.img
                        {...portraitProps(portrait)}
                        ref={(image) => {
                          if (image?.complete && image.naturalWidth > 0) {
                            setLoadedPortraits((current) =>
                              current[portrait]
                                ? current
                                : { ...current, [portrait]: true },
                            );
                          }
                        }}
                        key={portrait}
                        alt={siteConfig.identity.name}
                        className="polaroid-photo-image"
                        draggable={false}
                        loading="eager"
                        decoding="async"
                        fetchPriority={portrait === 0 ? "high" : "auto"}
                        onLoad={() =>
                          setLoadedPortraits((current) => ({
                            ...current,
                            [portrait]: true,
                          }))
                        }
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
                    </AnimatePresence>
                    <motion.div
                      key={`flash-${portrait}`}
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
                  </div>
                  <span>{`me_0${portrait + 1}.jpeg`}</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
        {siteConfig.features.about && <StableAboutSection />}
      </div>
    </section>
  );
}
