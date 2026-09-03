"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type RefObject } from "react";
import { CharReveal } from "../motion-text";
import { GalleryLightbox, PhotoCard } from "../media-interactions";
import { photographyImages } from "@/content/media";

export function Photography({
  sectionRef,
}: {
  sectionRef: RefObject<HTMLElement | null>;
}) {
  const [index, setIndex] = useState(0),
    [open, setOpen] = useState(false);
  return (
    <div className="container">
      <section ref={sectionRef} id="photography" style={{ padding: "6rem 0" }}>
        <motion.div
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.15, delayChildren: 0.2 },
            },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="section-inner"
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
              },
            }}
          >
            <h2 className="section-label">
              <CharReveal>Photography</CharReveal>
            </h2>
          </motion.div>
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
              },
            }}
            style={{ fontSize: "1.1rem", marginBottom: "2rem" }}
          >
            And hey, I love photography.
          </motion.p>
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
              },
            }}
            className="captures-grid"
          >
            {photographyImages.map((src, i) => (
              <PhotoCard
                key={src}
                src={src}
                index={i}
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
