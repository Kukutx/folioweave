"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useViewportActivity } from "@/hooks/use-viewport-activity";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { PortfolioMediaAsset } from "@/portfolio/schema";

const MotionImage = motion.create(Image);

export function MediaCarousel({
  images,
}: {
  images: readonly PortfolioMediaAsset[];
}) {
  // Mount the observed root with its hooks. Empty-to-populated updates must not
  // leave an observer permanently attached to an absent element.
  return images.length ? <CarouselContent images={images} /> : null;
}

function CarouselContent({
  images,
}: {
  images: readonly PortfolioMediaAsset[];
}) {
  const slides = images;
  const rootRef = useRef<HTMLDivElement>(null);
  const active = useViewportActivity(rootRef, "300px 0px");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState(0),
    [direction, setDirection] = useState(1),
    [hover, setHover] = useState(false);
  const next = useCallback(() => {
    setDirection(1);
    setIndex((value) => (value + 1) % slides.length);
  }, [slides.length]);
  const prev = () => {
    setDirection(-1);
    setIndex((value) => (value - 1 + slides.length) % slides.length);
  };
  useEffect(() => {
    if (hover || focused || !active || reducedMotion || slides.length < 2)
      return;
    const id = window.setInterval(next, 3000);
    return () => window.clearInterval(id);
  }, [active, hover, focused, next, reducedMotion, slides.length]);
  const currentIndex = index % slides.length;

  return (
    <div
      ref={rootRef}
      className="media-carousel"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div className="media-carousel-container">
        <AnimatePresence initial={false} custom={direction}>
          <MotionImage
            key={currentIndex}
            src={slides[currentIndex].src}
            alt={slides[currentIndex].alt}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            custom={direction}
            initial={{ x: direction > 0 ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: direction > 0 ? "-100%" : "100%" }}
            transition={{
              x: {
                type: "tween",
                duration: reducedMotion ? 0 : 0.4,
                ease: "easeInOut",
              },
            }}
            className="media-carousel-image"
            draggable={false}
          />
        </AnimatePresence>
        <button
          hidden={slides.length < 2}
          className="media-carousel-btn media-carousel-btn-prev"
          onClick={prev}
          aria-label="Previous image"
        >
          <ChevronLeft size={24} />
        </button>
        <button
          hidden={slides.length < 2}
          className="media-carousel-btn media-carousel-btn-next"
          onClick={next}
          aria-label="Next image"
        >
          <ChevronRight size={24} />
        </button>
        <div className="media-carousel-dots">
          {slides.map((_, slideIndex) => (
            <button
              key={slideIndex}
              className={`media-carousel-dot ${slideIndex === currentIndex ? "active" : ""}`}
              onClick={() => {
                setDirection(slideIndex > currentIndex ? 1 : -1);
                setIndex(slideIndex);
              }}
              aria-label={`Go to slide ${slideIndex + 1}`}
              aria-current={slideIndex === currentIndex ? "true" : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
