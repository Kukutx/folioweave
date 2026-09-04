"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { AppStoreBadge } from "./route-shared";
import { products } from "@/config/products";
import { siteCopyright } from "@/config/site";

const item = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};
const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

// The hero already owns opacity through the scroll MotionValue. Keeping opacity
// in its variants too makes Framer Motion 13 resolve competing animation
// sources during hydration and can leave the entire hero transparent. This
// variant only orchestrates the child stagger.
const heroContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function SentenceFade({
  children,
  style,
}: {
  children: string;
  style?: React.CSSProperties;
}) {
  const sentences = children.match(/[^.?!]+[.?!]+|[^.?!]+$/g) || [children];
  return (
    <motion.p
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10%" }}
      style={{ ...style, display: "block" }}
    >
      {sentences.map((s, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { duration: 1, ease: "easeOut" },
            },
          }}
        >
          {s}{" "}
        </motion.span>
      ))}
    </motion.p>
  );
}

export function CliptPage() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.2], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  useEffect(() => {
    scrollTo(0, 0);
  }, []);
  const tech = [
    [
      "Native SwiftUI & SwiftData",
      "The Clipt app is engineered as a modern, native SwiftUI application that leverages SwiftData for robust local persistence, ensuring your data is always available and loads instantly.",
    ],
    [
      "App Group Architecture",
      "It employs an App Group architecture to synchronize clipboard history seamlessly across the main app, a custom Keyboard Extension, and Widgets.",
    ],
    [
      "Intelligent ClipboardManager",
      "The core engine uses an observable pattern to monitor the system pasteboard in real-time, intelligently detecting content types (OTPs, colors, links) and inferring source devices.",
    ],
    [
      "Darwin Notifications",
      "Utilizes Darwin Notifications for efficient inter-process communication, ensuring that clips captured by the keyboard are instantly reflected in the main app without delay.",
    ],
    [
      "CoreSpotlight Integration",
      "Your history isn't just in the app—it's fully indexed. Integrate with CoreSpotlight to make clipboard history searchable directly from the iOS system search (Spotlight).",
    ],
    [
      "Privacy First",
      "All processing happens locally on your device. We don't track your clipboard content. It's your data, and it stays yours.",
    ],
  ];
  return (
    <div className="clipt-container">
      <nav style={{ position: "fixed", top: 24, left: 24, zIndex: 100 }}>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "white",
            textDecoration: "none",
            background: "rgba(0,0,0,.5)",
            padding: "8px 16px",
            borderRadius: 20,
            backdropFilter: "blur(10px)",
            fontSize: ".9rem",
          }}
        >
          <ArrowLeft size={16} /> Back to Portfolio
        </Link>
      </nav>
      <section className="clipt-hero clipt-section">
        <motion.div
          style={{ y, opacity }}
          initial="hidden"
          animate="visible"
          variants={heroContainer}
        >
          <motion.img
            src="/media/5c0589_4015772c87e6491eb8881e3764409267~mv2.webp"
            alt="Clipt Logo"
            className="clipt-logo"
            variants={item}
            style={{ filter: "drop-shadow(0 0 30px rgba(50,220,100,.4))" }}
          />
          <motion.h1 className="clipt-title" variants={item}>
            Your clipboard,
            <br />
            everywhere.
          </motion.h1>
          <motion.p className="clipt-subtitle" variants={item}>
            A beautifully engineered clipboard manager with seamless sync across
            iPhone, Mac and iPad, along with keyboard clipboard history for
            iPhone. Simple, secure, and native.
          </motion.p>
          <motion.div
            variants={item}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 80,
            }}
          >
            <AppStoreBadge
              href={products.clipt.appStore}
              className="app-store-button"
            />
          </motion.div>
        </motion.div>
        <motion.div
          className="clipt-images-hero"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
          style={{
            marginTop: 80,
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 24,
            width: "100%",
            maxWidth: 1400,
            marginLeft: "auto",
            marginRight: "auto",
            alignItems: "center",
          }}
        >
          {[
            "/media/5c0589_28405806566a41858265a0abb273e381~mv2.webp",
            "/media/5c0589_e130c4a5b3fb42a0b6369fbcc08e4184~mv2.webp",
            "/media/5c0589_6df61a722565437bb6d4716fb4d12808~mv2.webp",
          ].map((src, i) => (
            <motion.img
              key={src}
              src={src}
              style={{
                width: "100%",
                height: "auto",
                borderRadius: 16,
                boxShadow: "0 20px 40px rgba(0,0,0,.3)",
                border: "1px solid rgba(255,255,255,.1)",
              }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
              alt={`Clipt Screen ${i + 1}`}
              whileHover={{ y: -10, transition: { duration: 0.3 } }}
            />
          ))}
        </motion.div>
      </section>
      <section className="clipt-section clipt-story">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-20%" }}
        >
          <motion.h2 variants={item} className="clipt-section-title">
            The Story
          </motion.h2>
          <div style={{ marginBottom: 32 }}>
            <SentenceFade
              style={{ fontSize: "1.25rem", lineHeight: 1.7, color: "#86868b" }}
            >
              I have been a long-time Android user. When I shifted to iOS, I
              missed clipboard history a lot. I loved a few elements of the iOS
              ecosystem, like how all my devices are synced, but the lack of a
              native history tool was a gap I needed to fill.
            </SentenceFade>
          </div>
          <SentenceFade
            style={{ fontSize: "1.25rem", lineHeight: 1.7, color: "#86868b" }}
          >
            So, I decided to make an app where I can store all my clipboard
            history and implement it directly into the keyboard for instant
            access. It’s built to feel like it belongs on your iPhone—simple,
            fast, and respectful of your privacy.
          </SentenceFade>
        </motion.div>
      </section>
      <section className="clipt-section" style={{ marginBottom: 100 }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={container}
        >
          <motion.h2 variants={item} className="clipt-section-title">
            Under the hood
          </motion.h2>
          <motion.p
            variants={item}
            style={{
              textAlign: "center",
              color: "#888",
              maxWidth: 600,
              margin: "0 auto",
            }}
          >
            Built with the latest Apple technologies to ensure robustness and
            speed.
          </motion.p>
          <div
            className="clipt-tech-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            }}
          >
            {tech.map(([title, text]) => (
              <motion.div
                key={title}
                className="clipt-tech-item"
                variants={item}
              >
                <h4>{title}</h4>
                <p>{text}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>
      <footer style={{ textAlign: "center", paddingBottom: 80, color: "#444" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: ".9rem",
            color: "#666",
            marginBottom: 24,
          }}
        >
          <span>From the guy who built</span>
          <a
            href={products.notchShelf.appStore.product}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#999",
              textDecoration: "none",
              background: "rgba(255,255,255,.05)",
              padding: "4px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.1)",
            }}
          >
            <img
              src="/notchshelf-logo.webp"
              alt="NotchShelf"
              style={{ width: 20, height: 20, borderRadius: 5 }}
            />
            <span>NotchShelf</span>
          </a>
        </div>
        <div
          style={{
            color: "#666",
            fontSize: ".8rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <span>{siteCopyright}</span>
          <span style={{ color: "#333" }}>|</span>
          <Link
            href={products.clipt.privacyRoute}
            style={{ color: "#666", textDecoration: "none" }}
          >
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
