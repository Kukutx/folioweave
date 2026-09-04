"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type RefObject } from "react";
import { CharReveal } from "../motion-text";
import { GalleryLightbox, PhotoCard } from "../media-interactions";
import { photographyImages } from "@/content/media";
import { useMobileViewport } from "@/hooks/use-media-query";
import { sectionChildVariants, sectionRevealVariants } from "./motion-presets";

export function Photography({
  sectionRef,
}: {
  sectionRef: RefObject<HTMLElement | null>;
}) {
  const [index, setIndex] = useState(0),
    [open, setOpen] = useState(false);
  const mobile = useMobileViewport();

  return (
    <div className="container">
      <section ref={sectionRef} id="photography" style={{ padding: "6rem 0" }}>
        <motion.div
          variants={sectionRevealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="section-inner"
        >
          <motion.div
            variants={sectionChildVariants}
          >
            <h2 className="section-label">
              <CharReveal>Photography</CharReveal>
            </h2>
          </motion.div>
          <motion.p
            variants={sectionChildVariants}
            style={{ fontSize: "1.1rem", marginBottom: "2rem" }}
          >
            And hey, I love photography.
          </motion.p>
          <motion.div
            variants={sectionChildVariants}
            className="captures-grid"
          >
            {photographyImages.map((src, i) => (
              <PhotoCard
                key={src}
                src={src}
                index={i}
                disableHover={mobile}
                disableParallax={mobile}
                ariaLabel={`Open photograph ${i + 1} of ${photographyImages.length}`}
                onClick={() => {
                  setIndex(i);
                  setOpen(true);
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      </section>
      <AnimatePresence>
        {open && (
          <GalleryLightbox
            images={photographyImages}
            initialIndex={index}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
