"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type CSSProperties } from "react";
import { AboutSection } from "../about-section";
import { CharReveal } from "../motion-text";
import { ResumePrinter, type ResumeState } from "../media-interactions";
import { homeContent } from "@/content/home";
import { portraitImages } from "@/content/media";
import { useMobileViewport } from "@/hooks/use-media-query";
import { mailto, siteConfig } from "@/config/site";

const greetings = homeContent.greetings;

export function Hero() {
  const mobile = useMobileViewport(),
    [greet, setGreet] = useState(0),
    [portrait, setPortrait] = useState(0),
    [loadedPortraits, setLoadedPortraits] = useState<Record<number, boolean>>({}),
    [mobileTilt, setMobileTilt] = useState({ x: 0, y: 0 }),
    [resume, setResume] = useState<ResumeState>("idle");
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    const id = setInterval(
      () => setGreet((v) => (v + 1) % greetings.length),
      2000,
    );
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    // With SSR, a cached preload can finish before React attaches onLoad.
    // Reconcile the hidden preload images after hydration as a fallback.
    const reconcileCachedPortraits = () => {
      const loaded: Record<number, boolean> = {};
      document
        .querySelectorAll<HTMLImageElement>("img[data-portrait-preload]")
        .forEach((image, index) => {
          if (image.complete && image.naturalWidth > 0) loaded[index] = true;
        });
      if (!Object.keys(loaded).length) return;
      setLoadedPortraits((current) => {
        const missing = Object.keys(loaded).some((key) => !current[Number(key)]);
        return missing ? { ...current, ...loaded } : current;
      });
    };
    reconcileCachedPortraits();
    const frame = window.requestAnimationFrame(reconcileCachedPortraits);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!mobile || !("DeviceOrientationEvent" in window)) return;
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

    const enable = async () => {
      try {
        const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<"granted" | "denied">;
        };
        if (
          typeof orientation.requestPermission === "function" &&
          (await orientation.requestPermission()) !== "granted"
        )
          return;
        window.addEventListener("deviceorientation", onOrientation, { passive: true });
      } catch {
        // iOS can require an explicit gesture; static card remains the safe fallback.
      }
    };
    void enable();
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [mobile]);
  const next = () => setPortrait((v) => (v + 1) % portraitImages.length);
  return (
    <section
      id="home"
      className="hero-section"
      style={{ "--mouse-x": "50%", "--mouse-y": "50%" } as CSSProperties}
    >
      <div className="container">
        <div
          className={`hero-wrapper ${resume !== "idle" && resume !== "collapsing" && resume !== "morphing" ? "is-resume-active" : ""}`}
        >
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="hero-content"
          >
            <div className="hero-grid">
              <div className="hero-text-side">
                <h1 className="hero-title">
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
                    <AnimatePresence mode="wait">
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
                  </span>
                  <CharReveal delay={0.35} trigger className="hero-main-text">
                    {`I am ${siteConfig.identity.name}`}
                  </CharReveal>{" "}
                  <span className="hero-wave" aria-hidden>
                    👋
                  </span>
                </h1>
                <motion.div
                  className="hero-bio"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    delay: 0.75,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <p className="hero-role-line">
                    {`${siteConfig.identity.role} at `}
                    <span className="hero-brand-inline">
                      <img src="/assets/cred-icon-6de258e2.png" alt="CRED" />{" "}
                      {siteConfig.identity.company}
                    </span>
                  </p>
                  <p className="hero-summary">
                    {`Based in ${siteConfig.identity.country}, designing thoughtful digital experiences. Previously at `}
                    <span className="hero-brand-inline">
                      <img
                        src="/assets/district-icon-fad26ad7.png"
                        alt="District by Zomato"
                      /> District by Zomato
                    </span>
                    , where I worked on how millions discover and book movies.
                    On the side, I&apos;m building{" "}
                    <span className="hero-brand-inline">
                      <img src="/brink/logo.png" alt="Brink" /> Brink
                    </span>
                    , a podcast player.
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
                    <ResumePrinter state={resume} setState={setResume} />
                  </div>
                </div>
              </div>
              <div className="hero-image-side" style={{ position: "relative" }}>
                <motion.div
                  className="card-polaroid"
                  role="button"
                  tabIndex={0}
                  aria-label={`Show next portrait. Photo ${portrait + 1} of ${portraitImages.length}.`}
                  initial={{ opacity: 0, scale: 0.86, rotate: 6, y: -12 }}
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
                    rotateX: mobile ? mobileTilt.x : 0,
                    rotateY: mobile ? mobileTilt.y : 0,
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
                      {!loadedPortraits[portrait] && (
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
                        key={portrait}
                        src={portraitImages[portrait]}
                        alt={siteConfig.identity.name}
                        className="polaroid-photo-image"
                        draggable={false}
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
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
        <div style={{ display: "none" }}>
          {portraitImages.map((src, index) => (
            <img
              key={src}
              data-portrait-preload
              src={src}
              alt="preload"
              fetchPriority={index === 0 ? "high" : "low"}
              loading="eager"
              onLoad={() =>
                setLoadedPortraits((current) => ({
                  ...current,
                  [index]: true,
                }))
              }
            />
          ))}
        </div>
        <AboutSection />
      </div>
    </section>
  );
}
