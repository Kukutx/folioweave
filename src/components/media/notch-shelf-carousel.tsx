"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { notchShelfImages } from "@/content/media";
import { useViewportActivity } from "@/hooks/use-viewport-activity";

export function NotchShelfCarousel({
  images = notchShelfImages,
}: {
  images?: readonly string[];
} = {}) {
  const slides = images.length ? images : notchShelfImages;
  const rootRef = useRef<HTMLDivElement>(null);
  const active = useViewportActivity(rootRef, "300px 0px");
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
    if (hover || !active) return;
    const id = window.setInterval(next, 3000);
    return () => window.clearInterval(id);
  }, [active, hover, next]);
  useEffect(() => {
    slides.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, [slides]);
  const currentIndex = index % slides.length;

  return (
    <div
      ref={rootRef}
      className="notchshelf-carousel"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="notchshelf-carousel-container">
        <AnimatePresence initial={false} custom={direction}>
          <motion.img
            key={currentIndex}
            src={slides[currentIndex]}
            alt={`Carousel screenshot ${currentIndex + 1}`}
            custom={direction}
            initial={{ x: direction > 0 ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: direction > 0 ? "-100%" : "100%" }}
            transition={{
              x: { type: "tween", duration: 0.4, ease: "easeInOut" },
            }}
            className="notchshelf-carousel-image"
            draggable={false}
            decoding="async"
            fetchPriority="low"
          />
        </AnimatePresence>
        <button
          className="notchshelf-carousel-btn notchshelf-carousel-btn-prev"
          onClick={prev}
          aria-label="Previous image"
        >
          <ChevronLeft size={24} />
        </button>
        <button
          className="notchshelf-carousel-btn notchshelf-carousel-btn-next"
          onClick={next}
          aria-label="Next image"
        >
          <ChevronRight size={24} />
        </button>
        <div className="notchshelf-carousel-dots">
          {slides.map((_, slideIndex) => (
            <button
              key={slideIndex}
              className={`notchshelf-carousel-dot ${slideIndex === currentIndex ? "active" : ""}`}
              onClick={() => {
                setDirection(slideIndex > currentIndex ? 1 : -1);
                setIndex(slideIndex);
              }}
              aria-label={`Go to slide ${slideIndex + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
