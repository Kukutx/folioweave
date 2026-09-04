"use client";

import { AnimatePresence, motion } from "framer-motion";
import { products } from "@/config/products";
import { useMediaQuery } from "@/hooks/use-media-query";
import { podcastFeeds } from "@/config/podcasts";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type Podcast = (typeof podcastFeeds)[number] & { artwork: string };

type FloatPosition = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  size: number;
  depth: number;
  rotate: number;
  rotateDepth: number;
  bob: number;
  duration: number;
  delay: number;
};

const mobileShot = "/media/5c0589_233e313fa20e465fa100ea33fdf41490~mv2.webp";
const desktopShot = "/media/5c0589_65959611b6ab4f989ee0d2663a720e5e~mv2.webp";

const fallbackPodcasts: Podcast[] = podcastFeeds.map((feed) => ({
  ...feed,
  artwork: "",
}));

const positions: FloatPosition[] = [
  {
    top: "7%",
    left: "4%",
    size: 132,
    depth: 16,
    rotate: -10,
    rotateDepth: 2.5,
    bob: 7,
    duration: 6.3,
    delay: 0.2,
  },
  {
    top: "12%",
    left: "21%",
    size: 108,
    depth: 13,
    rotate: 6,
    rotateDepth: 1.9,
    bob: 6,
    duration: 7.1,
    delay: 0.7,
  },
  {
    top: "9%",
    right: "10%",
    size: 126,
    depth: 18,
    rotate: 7,
    rotateDepth: -2.5,
    bob: 9,
    duration: 6.8,
    delay: 0.4,
  },
  {
    top: "34%",
    left: "4%",
    size: 138,
    depth: 22,
    rotate: -7,
    rotateDepth: 2.2,
    bob: 8,
    duration: 6.7,
    delay: 1.2,
  },
  {
    top: "43%",
    right: "4%",
    size: 132,
    depth: 20,
    rotate: 8,
    rotateDepth: -2.1,
    bob: 10,
    duration: 7.8,
    delay: 0.5,
  },
  {
    bottom: "10%",
    left: "5%",
    size: 124,
    depth: 17,
    rotate: -8,
    rotateDepth: 2.8,
    bob: 8,
    duration: 6.1,
    delay: 1.5,
  },
  {
    bottom: "23%",
    right: "5%",
    size: 118,
    depth: 15,
    rotate: 5,
    rotateDepth: 1.8,
    bob: 6,
    duration: 7.4,
    delay: 0.3,
  },
  {
    bottom: "6%",
    right: "17%",
    size: 116,
    depth: 14,
    rotate: -5,
    rotateDepth: 1.6,
    bob: 6,
    duration: 7.9,
    delay: 1.1,
  },
];

function Phone({ screenshots }: { screenshots: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (screenshots.length <= 1) return;
    const id = window.setInterval(
      () => setIndex((value) => (value + 1) % screenshots.length),
      2600,
    );
    return () => window.clearInterval(id);
  }, [screenshots.length]);

  return (
    <div className="brink-phoneWrap" aria-label="Brink app preview">
      <div className="brink-phone">
        <div className="brink-phoneOuter" aria-hidden="true" />
        <div className="brink-phoneBezel" />
        <div className="brink-phoneScreen">
          <AnimatePresence mode="wait">
            <motion.img
              key={screenshots[index]}
              className="brink-phoneShot"
              src={screenshots[index]}
              alt=""
              initial={{ opacity: 0, scale: 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.995 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              draggable={false}
            />
          </AnimatePresence>
        </div>
      </div>
      <div className="brink-dots" role="tablist" aria-label="Screenshots">
        {screenshots.map((_, itemIndex) => (
          <button
            key={itemIndex}
            type="button"
            className={itemIndex === index ? "brink-dot isActive" : "brink-dot"}
            aria-label={`Show screenshot ${itemIndex + 1}`}
            aria-pressed={itemIndex === index}
            onClick={() => setIndex(itemIndex)}
          />
        ))}
      </div>
    </div>
  );
}

export function BrinkPage() {
  const mobile = useMediaQuery("(max-width: 768px)");
  // Keep the landing-page visuals deterministic. External RSS artwork may be
  // unavailable under restrictive production CSP rules, so the UI uses the
  // text tiles. /api/podcasts remains available independently.
  const podcasts = fallbackPodcasts;
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const raf = useRef(0);
  const screenshots = useMemo(
    () => [mobile ? mobileShot : desktopShot],
    [mobile],
  );



  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const move = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => setPointer({ x, y }));
    };
    const leave = () => setPointer({ x: 0, y: 0 });
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerleave", leave);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div className="brink-page">
      <div className="brink-floatingLayer" aria-hidden="true">
        {podcasts.map((podcast, index) => {
          const position = positions[index % positions.length];
          const style = {
            top: position.top,
            right: position.right,
            bottom: position.bottom,
            left: position.left,
            width: position.size,
            "--brink-bob-distance": `${position.bob}px`,
            "--brink-bob-duration": `${position.duration}s`,
            "--brink-bob-delay": `${position.delay}s`,
          } as CSSProperties;

          return (
            <motion.figure
              key={podcast.id}
              className="brink-podcastFloat"
              style={style}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: pointer.x * position.depth,
                y: pointer.y * position.depth * 0.72,
                rotate: position.rotate + pointer.x * position.rotateDepth,
              }}
              transition={{
                opacity: { duration: 0.42, delay: 0.12 + index * 0.04 },
                scale: { duration: 0.42, delay: 0.12 + index * 0.04 },
                x: { type: "spring", stiffness: 88, damping: 20, mass: 0.6 },
                y: { type: "spring", stiffness: 88, damping: 20, mass: 0.6 },
                rotate: { type: "spring", stiffness: 74, damping: 16 },
              }}
            >
              <div className="brink-podcastFloatInner">
                {podcast.artwork ? (
                  <img
                    className="brink-podcastArtwork"
                    src={podcast.artwork}
                    alt={`${podcast.title} cover artwork`}
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <div className="brink-podcastFallback">{podcast.title}</div>
                )}
              </div>
            </motion.figure>
          );
        })}
      </div>

      <main className="brink-shell">
        <section className="brink-left">
          <div className="brink-brand">
            <img
              className="brink-markImg"
              src="/brink/logo.png"
              alt=""
              draggable={false}
            />
            <div className="brink-word">Brink</div>
          </div>
          <h1 className="brink-title">Podcasts, Without the Noise</h1>
          <p className="brink-subtitle">
            Discover faster, stay organized, and keep listening sessions calm
            with a player built for focus.
          </p>
          <a
            className="brink-appStoreLink"
            href={products.brink.appStore.product}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Brink - Podcast Player on the App Store"
            title="Brink - Podcast Player"
          >
            <img
              className="brink-appStoreBadge"
              src="/assets/app-store-badge.svg"
              alt="Download Brink - Podcast Player on the App Store"
              draggable={false}
            />
          </a>
          <div className="brink-footlinks">
            <a href={products.brink.privacyRoute}>Privacy Policy</a>
          </div>
        </section>
        <section className="brink-right">
          <Phone screenshots={screenshots} />
        </section>
      </main>
    </div>
  );
}
