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
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal, flushSync } from "react-dom";
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

function ParallaxPhoto({
  target,
  children,
}: {
  target: RefObject<HTMLDivElement | null>;
  children: (y: MotionValue<string> | number, active: boolean) => ReactNode;
}) {
  // Only mount viewport/parallax observers when the caller actually enables
  // the effect. Mobile and reduced-motion cards stay as lightweight images.
  const active = useViewportActivity(target);
  return active ? (
    <ParallaxMotion target={target}>
      {(y) => children(y, active)}
    </ParallaxMotion>
  ) : (
    children(0, false)
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
  const tiltRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (hoverEnabled || !tiltRef.current) return;
    tiltRef.current.style.transform = "rotateX(0deg) rotateY(0deg)";
  }, [hoverEnabled]);
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
      {...mediaDimensions(src)}
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
        ref={tiltRef}
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
            !disableParallax && !reducedMotion ? (
              <ParallaxPhoto target={ref}>{renderImage}</ParallaxPhoto>
            ) : (
              renderImage(0, false)
            )
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
    [direction, setDirection] = useState(0),
    [keyboardClosing, setKeyboardClosing] = useState(false),
    [warmImageIndices, setWarmImageIndices] = useState([initialIndex]);
  const dimensions = mediaDimensions(images[index].src);
  const lightboxSizes =
    dimensions.width <= dimensions.height
      ? "(max-width: 767px) 85vw, 35vw"
      : "(max-width: 767px) 85vw, 70vw";
  const imageStyle = (imageIndex: number): CSSProperties => {
    const size = mediaDimensions(images[imageIndex].src);
    return {
      // Layout follows the authored source ratio and viewport, never the
      // optimizer's selected raster width (for example a 384px srcset entry).
      width: `min(${size.width}px, 100%, ${(85 * size.width) / size.height}dvh)`,
      height: "auto",
      aspectRatio: `${size.width} / ${size.height}`,
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain",
      position: "absolute",
      borderRadius: 4,
      boxShadow: "0 20px 50px rgba(0,0,0,.5)",
    };
  };
  const lightboxImageStyle = imageStyle(index);
  const staticImageIndices = [...warmImageIndices, index].filter(
    (value, position, values) => values.indexOf(value) === position,
  );
  const move = useCallback(
    (d: number, animate = true) => {
      setDirection(animate ? d : 0);
      setIndex((current) => (current + d + images.length) % images.length);
    },
    [images.length],
  );
  useEffect(() => {
    if (images.length < 2) return;
    const timer = window.setTimeout(() => {
      const desired = [
        (index - 1 + images.length) % images.length,
        index,
        (index + 1) % images.length,
      ].filter((value, position, values) => values.indexOf(value) === position);
      setWarmImageIndices(desired);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [images.length, index]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (images.length < 2) {
      dialog.dataset.neighborPreloadReady = "true";
      return;
    }
    dialog.dataset.neighborPreloadReady = "false";
    const adjacent = [
      (index - 1 + images.length) % images.length,
      (index + 1) % images.length,
    ];
    if (!adjacent.every((imageIndex) => warmImageIndices.includes(imageIndex)))
      return;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const neighbors = [
        ...dialog.querySelectorAll<HTMLImageElement>(
          'img[data-gallery-neighbor="true"]',
        ),
      ];
      void Promise.allSettled(
        neighbors.map((image) => image.decode().catch(() => {})),
      ).then(() => {
        if (!cancelled && dialogRef.current)
          dialogRef.current.dataset.neighborPreloadReady = "true";
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [images.length, index, warmImageIndices]);
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
        // This listener is attached directly to window, outside React's
        // discrete-event priority. Commit the keyboard swap synchronously so
        // the next paint is not delayed by the default scheduler queue.
        flushSync(() => move(event.key === "ArrowLeft" ? -1 : 1, false));
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
      exit={{ opacity: keyboardClosing ? 1 : 0 }}
      transition={{ duration: reducedMotion || keyboardClosing ? 0 : 0.3 }}
      className="gallery-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Photography viewer"
      onCancel={(event) => {
        event.preventDefault();
        // Native dialog cancel is outside React's discrete-event priority.
        // Commit both the zero-delay exit mode and parent unmount together so
        // keyboard Escape reaches its next paint without scheduler latency.
        flushSync(() => {
          setKeyboardClosing(true);
          onClose();
        });
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
        {reducedMotion || direction === 0 ? (
          <>
            {staticImageIndices.map((imageIndex) => {
              const asset = images[imageIndex];
              const size = mediaDimensions(asset.src);
              const sizes =
                size.width <= size.height
                  ? "(max-width: 767px) 85vw, 35vw"
                  : "(max-width: 767px) 85vw, 70vw";
              const current = imageIndex === index;
              return (
                <Image
                  key={asset.src}
                  src={asset.src}
                  alt={current ? asset.alt : ""}
                  aria-hidden={!current}
                  data-gallery-neighbor={current ? undefined : "true"}
                  {...size}
                  sizes={sizes}
                  loading="eager"
                  fetchPriority={current ? "high" : "auto"}
                  draggable={false}
                  style={{
                    ...imageStyle(imageIndex),
                    opacity: current ? 1 : 0,
                    pointerEvents: current ? "auto" : "none",
                    // Keep the warm lightbox trio on compositor-backed layers
                    // so the first keyboard swap does not pay a cold raster cost.
                    willChange: "opacity",
                    transform: "translateZ(0)",
                  }}
                />
              );
            })}
          </>
        ) : (
          <AnimatePresence initial={false} custom={direction}>
            <MotionImage
              key={index}
              src={images[index].src}
              alt={images[index].alt}
              {...dimensions}
              sizes={lightboxSizes}
              custom={direction}
              initial={{
                x: direction > 0 ? 96 : -96,
                opacity: 0,
                scale: 0.96,
              }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{
                x: direction < 0 ? 96 : -96,
                opacity: 0,
                scale: 0.96,
              }}
              transition={{
                x: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.14 },
                scale: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
              }}
              style={lightboxImageStyle}
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
        )}
      </div>
    </motion.dialog>,
    document.body,
  );
}
