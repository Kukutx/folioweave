"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export function PhotoCard({
  src,
  index,
  isPolaroid = false,
  onClick,
  disableHover = false,
  disableParallax = false,
  ariaLabel,
}: {
  src: string;
  index: number;
  isPolaroid?: boolean;
  onClick?: () => void;
  disableHover?: boolean;
  disableParallax?: boolean;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [loading, setLoading] = useState(true),
    [hover, setHover] = useState(false);
  const mx = useMotionValue(0),
    my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 150, damping: 15 }),
    sy = useSpring(my, { stiffness: 150, damping: 15 });
  const rotateX = useTransform(sy, [-0.5, 0.5], ["10deg", "-10deg"]),
    rotateY = useTransform(sx, [-0.5, 0.5], ["-10deg", "10deg"]);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    disableParallax ? ["0%", "0%"] : ["-10%", "10%"],
  );

  // Next.js may hydrate after an eager image is already complete, so onLoad
  // can be missed even though the image bytes are ready. Reconcile cached
  // images after mount while keeping the normal onLoad path for cold loads.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setLoading(false);
  }, [src]);

  const interactive = Boolean(onClick);
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onClick?.();
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      style={{ perspective: 1000, aspectRatio: isPolaroid ? "1/1.2" : "9/16" }}
      onMouseMove={
        disableHover
          ? undefined
          : (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              mx.set((e.clientX - r.left - r.width / 2) / r.width);
              my.set((e.clientY - r.top - r.height / 2) / r.height);
            }
      }
      onMouseLeave={
        disableHover
          ? undefined
          : () => {
              mx.set(0);
              my.set(0);
            }
      }
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? ariaLabel ?? `Open image ${index + 1}` : undefined}
    >
      <motion.div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: isPolaroid ? 2 : 24,
          overflow: "hidden",
          rotateX: isPolaroid ? rotateX : 0,
          rotateY: isPolaroid ? rotateY : 0,
          cursor: "pointer",
          boxShadow: "0 4px 15px rgba(0,0,0,.1)",
          position: "relative",
          background: isPolaroid ? "rgba(255,255,255,.9)" : "#fff",
          backdropFilter: isPolaroid ? "blur(4px)" : "none",
          WebkitBackdropFilter: isPolaroid ? "blur(4px)" : "none",
          padding: isPolaroid ? "12px 12px 40px 12px" : 0,
          border: isPolaroid
            ? "1px solid rgba(255,255,255,0.5)"
            : "none",
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        whileHover={{ zIndex: 10, boxShadow: "0 20px 40px rgba(0,0,0,.2)" }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {loading && <div className="skeleton-loader" />}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: isPolaroid ? 0 : "inherit",
            backgroundColor: "#000",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
              }}
            />
          )}
          <motion.img
            ref={imageRef}
            src={src}
            alt="Photography"
            onLoad={() => setLoading(false)}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            initial={{ opacity: 0 }}
            animate={{ opacity: loading ? 0 : 1, scale: hover ? 1.1 : 1 }}
            transition={{
              opacity: { duration: 0.3 },
              scale: { duration: 0.4, ease: "easeOut" },
            }}
            style={{
              width: "100%",
              height: isPolaroid ? "100%" : "120%",
              objectFit: "cover",
              pointerEvents: "none",
              y: isPolaroid ? 0 : y,
              position: isPolaroid ? "relative" : "absolute",
              top: isPolaroid ? 0 : "-10%",
              left: 0,
              borderRadius: isPolaroid ? 0 : "inherit",
              willChange: "transform",
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function GalleryLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: readonly string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex),
    [direction, setDirection] = useState(0);
  const move = useCallback(
    (d: number) => {
      setDirection(d);
      setIndex((i) => (i + d + images.length) % images.length);
    },
    [images.length],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [move, onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="gallery-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Photography viewer"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.95)",
        zIndex: 20001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(10px)",
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close gallery"
        style={{
          position: "absolute",
          top: "2rem",
          right: "2rem",
          background: "rgba(255,255,255,.1)",
          border: 0,
          borderRadius: "50%",
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          zIndex: 10,
          cursor: "pointer",
        }}
      >
        <X size={24} />
      </button>
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,.6)",
          fontFamily: "var(--font-main)",
          fontSize: ".9rem",
        }}
      >
        {index + 1} / {images.length}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          move(-1);
        }}
        className="gallery-nav-btn prev"
        aria-label="Previous image"
        style={{
          position: "absolute",
          left: "2rem",
          background: "rgba(255,255,255,.1)",
          border: 0,
          borderRadius: "50%",
          width: 56,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          zIndex: 10,
          cursor: "pointer",
          transition: "background 0.2s",
        }}
      >
        <ChevronLeft size={28} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          move(1);
        }}
        className="gallery-nav-btn next"
        aria-label="Next image"
        style={{
          position: "absolute",
          right: "2rem",
          background: "rgba(255,255,255,.1)",
          border: 0,
          borderRadius: "50%",
          width: 56,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          zIndex: 10,
          cursor: "pointer",
          transition: "background 0.2s",
        }}
      >
        <ChevronRight size={28} />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "85vw",
          height: "85vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.img
            key={index}
            src={images[index]}
            custom={direction}
            initial={{
              x: direction > 0 ? 1000 : -1000,
              opacity: 0,
              scale: 0.8,
            }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: direction < 0 ? 1000 : -1000, opacity: 0, scale: 0.8 }}
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              position: "absolute",
              borderRadius: 4,
              boxShadow: "0 20px 50px rgba(0,0,0,.5)",
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(_, info) => {
              const score = Math.abs(info.offset.x) * info.velocity.x;
              if (score < -10000) move(1);
              else if (score > 10000) move(-1);
            }}
          />
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
