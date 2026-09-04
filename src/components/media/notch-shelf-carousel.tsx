"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { notchShelfImages } from "@/content/media";

export function NotchShelfCarousel() {
  const [index, setIndex] = useState(0),
    [direction, setDirection] = useState(1),
    [hover, setHover] = useState(false);
  const next = useCallback(() => {
    setDirection(1);
    setIndex((v) => (v + 1) % notchShelfImages.length);
  }, []);
  const prev = () => {
    setDirection(-1);
    setIndex(
      (v) => (v - 1 + notchShelfImages.length) % notchShelfImages.length,
    );
  };
  useEffect(() => {
    if (hover) return;
    const id = setInterval(next, 3000);
    return () => clearInterval(id);
  }, [hover, next]);
  useEffect(() => {
    notchShelfImages.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, []);
  return (
    <div
      className="notchshelf-carousel"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="notchshelf-carousel-container">
        <AnimatePresence initial={false} custom={direction}>
          <motion.img
            key={index}
            src={notchShelfImages[index]}
            alt={`NotchShelf Screenshot ${index + 1}`}
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
          {notchShelfImages.map((_, i) => (
            <button
              key={i}
              className={`notchshelf-carousel-dot ${i === index ? "active" : ""}`}
              onClick={() => {
                setDirection(i > index ? 1 : -1);
                setIndex(i);
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
