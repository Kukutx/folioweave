"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type RefObject } from "react";
import { WordReveal } from "../motion-text";
import { sectionChildVariants, sectionRevealVariants } from "./motion-presets";
import { useMobileViewport } from "@/hooks/use-media-query";

const NIGHT_STAR_LAYOUT = (() => {
  // Seeded pseudo-random layout keeps the original organic star field while
  // producing identical SSR and hydration output in Next.js.
  let seed = 123456789;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: 50 }, (_, id) => ({
    id,
    x: random() * 100,
    y: random() * 100,
    size: random() * 2 + 1,
    delay: random() * 2,
    duration: random() * 1.5 + 0.5,
  }));
})();

export function NightAndSimple({
  sectionRef,
}: {
  sectionRef: RefObject<HTMLElement | null>;
}) {
  const mountain = useRef<HTMLDivElement>(null);
  const mobile = useMobileViewport();
  const { scrollYProgress } = useScroll({
    target: mountain,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["18%", "-18%"]);
  const stars = NIGHT_STAR_LAYOUT;
  return (
    <main id="main-content">
      <section ref={sectionRef} className="night-section">
        <div className="star-field">
          {stars.map((s) => (
            <motion.div
              key={s.id}
              className="star"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.size,
                height: s.size,
              }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.2, 1] }}
              transition={{
                duration: s.duration,
                repeat: Infinity,
                delay: s.delay,
                ease: "easeInOut",
              }}
            />
          ))}
          <div className="falling-star-container">
            <div className="falling-star fs-1" />
            <div className="falling-star fs-2" />
            <div className="falling-star fs-3" />
          </div>
        </div>
        <div className="container night-content">
          <motion.div
            variants={sectionRevealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div variants={sectionChildVariants}>
              <h2 className="night-text">
                <WordReveal color="#fff" style={{ overflow: "visible" }}>
                  Sometimes, I zoom out.
                </WordReveal>
              </h2>
            </motion.div>
            <motion.p
              className="night-desc section-supporting-copy"
              variants={sectionChildVariants}
            >
              The best decisions rarely come from staring harder at the screen.
              They come from stepping back — seeing how one small choice ripples
              through a whole system, and remembering the person on the other
              end of it.
            </motion.p>
          </motion.div>
        </div>
      </section>
      <section
        className="blank-section"
        style={{
          paddingBottom: 0,
          marginBottom: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {["one", "two", "three", "four"].map((n) => (
          <div key={n} className={`bird-container bird-container-${n}`}>
            <div className={`bird bird-${n}`} />
          </div>
        ))}
        <div className="container">
          <motion.div
            variants={sectionRevealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            style={{
              textAlign: "center",
              paddingTop: "10vh",
              paddingBottom: 0,
              marginBottom: 0,
            }}
          >
            <motion.div variants={sectionChildVariants}>
              <h2 className="simple-text">
              <WordReveal>Then I bring it back down.</WordReveal>
              <br />
              <span style={{ position: "relative", display: "inline-block" }}>
                <WordReveal delay={0.2} className="simple-text-handwritten">
                  And keep it simple.
                </WordReveal>
                <svg
                  viewBox="0 0 300 20"
                  fill="none"
                  style={{
                    position: "absolute",
                    bottom: "-15px",
                    left: "-10%",
                    width: "120%",
                    height: ".6em",
                    zIndex: -1,
                    pointerEvents: "none",
                    overflow: "visible",
                  }}
                >
                  <motion.path
                    d="M5 12C50 2 100 20 150 12C200 4 250 15 295 10"
                    stroke="#FFD54F"
                    strokeWidth="12"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 0.4 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, delay: 1.2 }}
                  />
                </svg>
              </span>
              </h2>
            </motion.div>
            <motion.p
              variants={sectionChildVariants}
              className="section-supporting-copy"
              style={{ margin: "2rem auto 0", maxWidth: 800 }}
            >
              Good solutions don&apos;t ask for attention. They just
              work—quietly and effectively.
            </motion.p>
          </motion.div>
        </div>
        <motion.div
          ref={mountain}
          className="mountain-frame"
          style={{
            width: "100vw",
            marginLeft: "calc(-50vw + 50%)",
            marginTop: mobile ? "4rem" : 0,
            marginBottom: 0,
            lineHeight: 0,
            position: "relative",
            overflow: "hidden",
            WebkitBackfaceVisibility: "hidden",
            backfaceVisibility: "hidden",
            transform: "translateZ(0)",
            opacity: 1,
          }}
        >
          <motion.div
            className="mountain-media"
            style={{
              position: "relative",
              display: "block",
              overflow: "hidden",
              y: mobile ? 0 : y,
            }}
          >
            <img
              className="mountain-image"
              src="/media/5c0589_8d8640a87e5a4209b0cb5e6ba984ddc8~mv2.webp"
              alt=""
              width={1920}
              height={765}
              decoding="async"
              fetchPriority="low"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                willChange: mobile ? "auto" : "transform",
                transform: "translateZ(0)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                imageRendering: "auto",
              }}
            />
            {!mobile && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "60%",
                  background:
                    "linear-gradient(to bottom,transparent 0%,transparent 40%,rgba(255,255,255,.15) 55%,rgba(255,255,255,.4) 70%,rgba(255,255,255,.7) 85%,#fff 100%)",
                  pointerEvents: "none",
                  mixBlendMode: "normal",
                  opacity: 1,
                  visibility: "visible",
                }}
              />
            )}
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
