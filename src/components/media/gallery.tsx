"use client";

import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { PortfolioMediaAsset } from "@/portfolio/schema";
import { lockPageScroll } from "@/lib/scroll-lock";
import { mediaDimensions } from "@/portfolio/media";
import { useViewportActivity } from "@/hooks/use-viewport-activity";
import { useMediaQuery } from "@/hooks/use-media-query";

const MotionImage = motion.create(Image);

function ParallaxMotion({
  target,
  children,
}: {
  target: RefObject<HTMLDivElement | null>;
  children: (y: MotionValue<string>) => ReactNode;
}) {
  const { scrollYProgress } = useScroll({
    target,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  return children(y);
}

function VisiblePhoto({
  target,
  parallax,
  children,
}: {
  target: RefObject<HTMLDivElement | null>;
  parallax: boolean;
  children: (y: MotionValue<string> | number, active: boolean) => ReactNode;
}) {
  // One lifecycle owns both scroll subscriptions and image compositing. Keep
  // fractional image sampling stable in view, without promoting distant cards.
  const active = useViewportActivity(target);
  return active && parallax ? (
    <ParallaxMotion target={target}>
      {(y) => children(y, active)}
    </ParallaxMotion>
  ) : (
    children(0, active)
  );
}

export function PhotoCard({
  image,
  index,
  isPolaroid = false,
  onClick,
  disableHover = false,
  disableParallax = false,
  ariaLabel,
}: {
  image: PortfolioMediaAsset;
  index: number;
  isPolaroid?: boolean;
  onClick?: () => void;
  disableHover?: boolean;
  disableParallax?: boolean;
  ariaLabel?: string;
}) {
  const { src, alt } = image;
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const hoverEnabled = !disableHover && !reducedMotion;
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const interactive = Boolean(onClick);
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onClick?.();
  };

  const renderImage = (
    parallaxY: MotionValue<string> | number,
    active: boolean,
  ) => (
    <MotionImage
      src={src}
      alt={alt}
      loading="lazy"
      fill
      sizes={
        isPolaroid
          ? "(max-width: 767px) 70vw, 25vw"
          : "(max-width: 767px) 100vw, 33vw"
      }
      initial={false}
      animate={{ opacity: 1, scale: hoverEnabled && hover ? 1.1 : 1 }}
      transition={{
        opacity: { duration: 0.3 },
        scale: { duration: reducedMotion ? 0 : 0.4, ease: "easeOut" },
      }}
      style={{
        width: "100%",
        height: isPolaroid ? "100%" : "120%",
        objectFit: "cover",
        pointerEvents: "none",
        y: isPolaroid ? 0 : parallaxY,
        position: "absolute",
        top: isPolaroid ? 0 : "-10%",
        left: 0,
        borderRadius: isPolaroid ? 0 : "inherit",
        willChange: isPolaroid || active ? "transform" : "auto",
        transform: isPolaroid ? "translateZ(0)" : undefined,
        backfaceVisibility:
          isPolaroid || parallaxY !== 0 ? "hidden" : "visible",
        WebkitBackfaceVisibility:
          isPolaroid || parallaxY !== 0 ? "hidden" : "visible",
      }}
    />
  );

  return (
    <motion.div
      ref={ref}
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.5,
        delay: reducedMotion ? 0 : (index % 4) * 0.1,
      }}
      viewport={{ once: true }}
      style={{ perspective: 1000, aspectRatio: isPolaroid ? "1/1.2" : "9/16" }}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        interactive ? (ariaLabel ?? `Open image ${index + 1}`) : undefined
      }
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: isPolaroid ? 2 : 24,
          overflow: "hidden",
          cursor: interactive ? "pointer" : "default",
          boxShadow:
            hoverEnabled && hover
              ? "0 20px 40px rgba(0,0,0,.2)"
              : "0 4px 15px rgba(0,0,0,.1)",
          position: "relative",
          zIndex: hoverEnabled && hover ? 10 : undefined,
          background: isPolaroid ? "rgba(255,255,255,.9)" : "#fff",
          backdropFilter: isPolaroid ? "blur(4px)" : "none",
          WebkitBackdropFilter: isPolaroid ? "blur(4px)" : "none",
          padding: isPolaroid ? "12px 12px 40px 12px" : 0,
          border: isPolaroid ? "1px solid rgba(255,255,255,0.5)" : "none",
          transition:
            isPolaroid && hoverEnabled
              ? "transform 180ms ease-out, box-shadow 250ms ease"
              : "box-shadow 250ms ease",
          transform: "rotateX(0deg) rotateY(0deg)",
        }}
        onMouseMove={
          isPolaroid && hoverEnabled
            ? (event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x =
                  (event.clientX - rect.left - rect.width / 2) / rect.width;
                const y =
                  (event.clientY - rect.top - rect.height / 2) / rect.height;
                event.currentTarget.style.transform = `rotateX(${-y * 20}deg) rotateY(${x * 20}deg)`;
              }
            : undefined
        }
        onMouseEnter={() => setHover(hoverEnabled)}
        onMouseLeave={(event) => {
          setHover(false);
          event.currentTarget.style.transform = "rotateX(0deg) rotateY(0deg)";
        }}
      >
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
          {!isPolaroid ? (
            <VisiblePhoto
              target={ref}
              parallax={!disableParallax && !reducedMotion}
            >
              {renderImage}
            </VisiblePhoto>
          ) : (
            renderImage(0, true)
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function GalleryLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: readonly PortfolioMediaAsset[];
  initialIndex: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [index, setIndex] = useState(initialIndex),
    [direction, setDirection] = useState(0);
  const [decodedSrc, setDecodedSrc] = useState<string | null>(null);
  const dimensions = mediaDimensions(images[index].src);
  const move = useCallback(
    (d: number) => {
      setDirection(d);
      setIndex((i) => (i + d + images.length) % images.length);
    },
    [images.length],
  );
  useLayoutEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    const root = document.documentElement;
    const rootBackground = root.style.backgroundColor;
    const rootBackgroundPriority =
      root.style.getPropertyPriority("background-color");
    // Reserve only an existing classic scrollbar; do not add a gutter on
    // touch/overlay-scrollbar devices and change their normal page width.
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    // Paint the reserved gutter while this modal owns it. A root :has()
    // selector would invalidate document-wide styles on every open/close.
    if (scrollbarWidth > 0) root.style.backgroundColor = "#000";
    const releaseScroll = lockPageScroll();
    dialog?.showModal();
    dialog?.style.setProperty("--modal-scrollbar-width", `${scrollbarWidth}px`);
    closeButtonRef.current?.focus({ preventScroll: true });

    const key = (event: KeyboardEvent) => {
      // Native modality makes the background inert. Explicit wrapping keeps
      // Tab in the viewer instead of moving into browser chrome at the edge.
      if (event.key === "Tab") {
        const controls = [
          ...(dialog?.querySelectorAll<HTMLButtonElement>(
            "button:not([disabled]):not([hidden])",
          ) ?? []),
        ];
        const first = controls[0];
        const last = controls.at(-1);
        if (
          first &&
          last &&
          ((event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last))
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      dialog?.close();
      if (scrollbarWidth > 0) {
        if (rootBackground)
          root.style.setProperty(
            "background-color",
            rootBackground,
            rootBackgroundPriority,
          );
        else root.style.removeProperty("background-color");
      }
      releaseScroll();
      previousFocus?.focus({ preventScroll: true });
    };
  }, [move]);
  return createPortal(
    <motion.dialog
      ref={dialogRef}
      initial={{ opacity: reducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
      className="gallery-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Photography viewer"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        width: "calc(100vw + var(--modal-scrollbar-width, 0px))",
        height: "100dvh",
        maxWidth: "none",
        maxHeight: "none",
        margin: 0,
        padding: 0,
        border: 0,
        background: "transparent",
        zIndex: 20001,
        alignItems: "center",
        justifyContent: "center",
        contain: "layout paint",
      }}
      onClick={onClose}
    >
      <button
        ref={closeButtonRef}
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
        aria-live="polite"
        aria-atomic="true"
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
          height: "85dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <AnimatePresence initial={false} custom={direction}>
          <MotionImage
            key={index}
            src={images[index].src}
            alt={images[index].alt}
            {...dimensions}
            sizes="85vw"
            onLoad={() => setDecodedSrc(images[index].src)}
            custom={direction}
            initial={{
              x: reducedMotion ? 0 : direction > 0 ? 1000 : -1000,
              opacity: reducedMotion ? 1 : 0,
              scale: reducedMotion ? 1 : 0.8,
            }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{
              x: reducedMotion ? 0 : direction < 0 ? 1000 : -1000,
              opacity: 0,
              scale: reducedMotion ? 1 : 0.8,
            }}
            transition={{
              x: reducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: reducedMotion ? 0 : 0.2 },
            }}
            style={{
              width:
                decodedSrc === images[index].src
                  ? "auto"
                  : `min(${dimensions.width}px, 100%, ${(85 * dimensions.width) / dimensions.height}dvh)`,
              height: "auto",
              // Reserve the source ratio while loading; once decoded, retain
              // the browser's exact ratio (optimized image rounding included).
              aspectRatio: `auto ${dimensions.width} / ${dimensions.height}`,
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
    </motion.dialog>,
    document.body,
  );
}
