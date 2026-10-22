"use client";

import { AnimatePresence, motion } from "framer-motion";
import { memo, useCallback, useRef, useState } from "react";
import { CharReveal } from "@/components/motion-text";
import { GalleryLightbox, PhotoCard } from "@/components/media/gallery";
import { photographyImages } from "@/content/media";
import { homeContent } from "@/content/home";
import { useMobileViewport } from "@/hooks/use-media-query";
import { useViewReveal } from "@/hooks/use-view-reveal";
import { sectionChildVariants, sectionRevealVariants } from "./motion-presets";

// Keep the entire motion-provider subtree outside modal state updates.
// Memoizing cards alone does not isolate them from changed motion context.
const PhotographyContent = memo(function PhotographyContent({
  onSelect,
}: {
  onSelect: (index: number) => void;
}) {
  const mobile = useMobileViewport();
  const inner = useRef<HTMLDivElement>(null);
  const reveal = useViewReveal(inner);
  return (
    <section id="photography" style={{ padding: "6rem 0" }}>
      <motion.div
        ref={inner}
        variants={sectionRevealVariants}
        initial={false}
        animate={reveal}
        className="section-inner"
      >
        <motion.div variants={sectionChildVariants}>
          <h2 className="section-label">
            <CharReveal>Photography</CharReveal>
          </h2>
        </motion.div>
        <motion.p
          variants={sectionChildVariants}
          style={{ fontSize: "1.1rem", marginBottom: "2rem" }}
        >
          {homeContent.photographyIntro}
        </motion.p>
        <div className="captures-grid">
          {photographyImages.map((image, i) => (
            <PhotoCard
              key={`${image.src}-${i}`}
              image={image}
              index={i}
              disableHover={mobile}
              disableParallax={mobile}
              revealOnScroll
              ariaLabel={`Open photograph ${i + 1} of ${photographyImages.length}`}
              onClick={() => onSelect(i)}
            />
          ))}
        </div>
      </motion.div>
    </section>
  );
});

export function Photography() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const closeGallery = useCallback(() => setSelectedIndex(null), []);
  return (
    <div className="container">
      <PhotographyContent onSelect={setSelectedIndex} />
      <AnimatePresence>
        {selectedIndex !== null && (
          <GalleryLightbox
            images={photographyImages}
            initialIndex={selectedIndex}
            onClose={closeGallery}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
