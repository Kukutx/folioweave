"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Award, MessageSquareText } from "lucide-react";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CharReveal } from "../motion-text";
import { NotchShelfCarousel } from "../media-interactions";
import { workItems } from "@/content/work";
import { products } from "@/config/products";
import { useMobileViewport } from "@/hooks/use-media-query";
import { sectionChildVariants, sectionRevealVariants } from "./motion-presets";

function WorkImage({
  desktop,
  mobile,
  alt,
}: {
  desktop: string;
  mobile: string;
  alt: string;
}) {
  const isMobile = useMobileViewport();
  return <img src={isMobile ? mobile : desktop} alt={alt} />;
}
function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: ".4rem",
        textDecoration: "none",
        color: "inherit",
        fontWeight: 500,
        fontSize: ".9rem",
        borderBottom: "1px solid currentColor",
        paddingBottom: 2,
        cursor: "pointer",
      }}
    >
      {children} <ArrowUpRight size={16} />
    </a>
  );
}

function OriginalBookOpenIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-book-open"
      aria-hidden
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function WorkSection() {
  const mobile = useMobileViewport();
  const [preview, setPreview] = useState<{
    src: string;
    x: number;
    y: number;
  } | null>(null);
  const common = (description: string) => (
    <p
      style={{
        fontSize: "clamp(1rem,4vw,1.1rem)",
        opacity: 0.8,
        lineHeight: 1.6,
      }}
    >
      {description}
    </p>
  );
  return (
    <div className="container">
      <section id="work">
        <motion.div
          variants={sectionRevealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="section-inner"
        >
          <motion.div variants={sectionChildVariants} style={{ marginBottom: "4rem" }}>
            <h2 className="section-label">
              <CharReveal>Work</CharReveal>
            </h2>
          </motion.div>
          <div className="work-list">
            <motion.div
              variants={sectionChildVariants}
              className="work-item responsive-work-image"
              style={{ marginBottom: "6rem" }}
            >
              <div className="work-content">
                <div className="work-body">
                  <div className="work-image-container">
                    <WorkImage
                      desktop={workItems.district.desktopImage}
                      mobile={workItems.district.mobileImage}
                      alt={workItems.district.name}
                    />
                  </div>
                  <div className="work-text-side">
                    <span className="work-text-company">
                      <img
                        src={workItems.district.icon}
                        alt=""
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          verticalAlign: "middle",
                        }}
                      />{" "}
                      {workItems.district.name}
                    </span>
                    <div className="work-meta">{workItems.district.date}</div>
                    {common(workItems.district.description)}
                    <div
                      className="award-badge shimmer-badge"
                      style={{ alignSelf: "flex-start" }}
                    >
                      <Award size={12} />
                      <span>{products.district.award}</span>
                    </div>
                    <div>
                      <Link
                        href={products.district.route}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: ".4rem",
                          textDecoration: "none",
                          color: "inherit",
                          fontWeight: 500,
                          fontSize: ".9rem",
                          borderBottom: "1px solid currentColor",
                          paddingBottom: 2,
                        }}
                      >
                        View Case Study <ArrowUpRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="story-time-box"
                  style={{
                    marginTop: "2rem",
                    padding: "1.5rem",
                    background: `
                      repeating-linear-gradient(
                        0deg,
                        rgba(0,0,0,.015) 0px,
                        rgba(0,0,0,.015) 1px,
                        transparent 1px,
                        transparent 2px
                      ),
                      linear-gradient(
                        to bottom,
                        rgba(255,255,255,.8) 0%,
                        rgba(250,248,245,.9) 100%
                      )
                    `,
                    backgroundSize: "100% 4px, 100% 100%",
                    border: "1px solid rgba(0,0,0,.08)",
                    borderRadius: 12,
                    borderLeft: "3px solid rgba(0,0,0,.15)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,.8), 0 1px 2px rgba(0,0,0,.05)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: "1rem",
                    }}
                  >
                    <MessageSquareText size={18} style={{ opacity: 0.7 }} />
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: ".95rem",
                        color: "#666",
                      }}
                    >
                      Story time
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <motion.div
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setPreview({
                          src: "/media/5c0589_2b7dce66597e49978dc260479073bd5d~mv2.webp",
                          x: r.left + r.width / 2,
                          y: r.top + r.height / 2,
                        });
                      }}
                      onMouseLeave={() => setPreview(null)}
                      onMouseMove={(e) =>
                        setPreview((p) =>
                          p ? { ...p, x: e.clientX, y: e.clientY } : p,
                        )
                      }
                      style={{ position: "relative", display: "inline-block" }}
                    >
                      <img
                        src="/media/5c0589_2b7dce66597e49978dc260479073bd5d~mv2.webp"
                        alt="Deepinder Goyal's reply"
                        style={{
                          width: "100%",
                          maxWidth: 400,
                          borderRadius: 8,
                          border: "1px solid rgba(0,0,0,.1)",
                          background: "#fff",
                          flexShrink: 0,
                          cursor: "zoom-in",
                          transition: "transform 0.2s ease",
                        }}
                      />
                    </motion.div>
                    <motion.p
                      variants={sectionChildVariants}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, margin: "-10%" }}
                      style={{
                        fontSize: ".95rem",
                        lineHeight: 1.6,
                        opacity: 0.8,
                        flex: 1,
                        minWidth: 200,
                        margin: 0,
                      }}
                    >
                      I mailed Deepinder Goyal, founder of Zomato, and he
                      replied! This conversation led to my internship at
                      District by Zomato, which later converted to a full-time
                      role. Sometimes, reaching out directly to the people you
                      admire can open doors you never expected.
                    </motion.p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
            <motion.div
              variants={sectionChildVariants}
              className="work-item mobile-featured-work mobile-work-brink responsive-work-image"
              style={{ marginBottom: "6rem" }}
            >
              <div className="work-content">
                <div className="work-body">
                  <div className="work-image-container">
                    <WorkImage
                      desktop={workItems.brink.desktopImage}
                      mobile={workItems.brink.mobileImage}
                      alt="Brink podcast discovery screens"
                    />
                  </div>
                  <div className="work-text-side">
                    <span className="work-text-company">
                      <img
                        src={workItems.brink.icon}
                        alt=""
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          verticalAlign: "middle",
                        }}
                      />{" "}
                      Brink
                    </span>
                    <div className="work-meta">{workItems.brink.date}</div>
                    {common(workItems.brink.description)}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        justifyContent: mobile ? "center" : "flex-start",
                      }}
                    >
                      <a
                        className="award-badge shimmer-badge"
                        href={products.brink.press}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Award size={12} />
                        <span>Featured on 9to5Mac</span>
                      </a>
                    </div>
                    <div>
                      <ExternalLink href={products.brink.appStore.portfolio}>
                        View in App Store
                      </ExternalLink>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              variants={sectionChildVariants}
              className="work-item mobile-featured-work mobile-work-clipt responsive-work-image"
              style={{ marginBottom: "6rem" }}
            >
              <div className="work-content">
                <div className="work-body">
                  <div className="work-image-container">
                    <WorkImage
                      desktop={workItems.clipt.desktopImage}
                      mobile={workItems.clipt.mobileImage}
                      alt="Clipt - Clipboard History"
                    />
                  </div>
                  <div className="work-text-side">
                    <span className="work-text-company">
                      <img
                        src={workItems.clipt.icon}
                        alt=""
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          verticalAlign: "middle",
                        }}
                      />{" "}
                      Clipt
                    </span>
                    <div className="work-meta">{workItems.clipt.date}</div>
                    {common(workItems.clipt.description)}
                    <div className="award-badge-blue">
                      <Award size={12} />
                      <span>#1 Paid App in India - App Store</span>
                    </div>
                    <div>
                      <Link
                        href={products.clipt.route}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: ".4rem",
                          textDecoration: "none",
                          color: "inherit",
                          fontWeight: 500,
                          fontSize: ".9rem",
                          borderBottom: "1px solid currentColor",
                          paddingBottom: 2,
                          cursor: "pointer",
                        }}
                      >
                        View Product <ArrowUpRight size={16} />
                      </Link>
                      <Link
                        href={products.clipt.storyRoute}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: ".4rem",
                          textDecoration: "none",
                          color: "var(--color-accent)",
                          fontWeight: 500,
                          fontSize: ".9rem",
                          borderBottom: "1px solid transparent",
                          paddingBottom: 2,
                          cursor: "pointer",
                          marginLeft: "1.5rem",
                        }}
                        onMouseOver={(event) => {
                          event.currentTarget.style.borderBottomColor =
                            "var(--color-accent)";
                        }}
                        onMouseOut={(event) => {
                          event.currentTarget.style.borderBottomColor =
                            "transparent";
                        }}
                      >
                        Read the Story <OriginalBookOpenIcon size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              variants={sectionChildVariants}
              className="work-item mobile-featured-work mobile-work-habee responsive-work-image"
              style={{ marginBottom: "6rem" }}
            >
              <div className="work-content">
                <div className="work-body">
                  <div className="work-image-container">
                    <WorkImage
                      desktop={workItems.habee.desktopImage}
                      mobile={workItems.habee.mobileImage}
                      alt="Habee - Habit Tracker"
                    />
                  </div>
                  <div className="work-text-side">
                    <span className="work-text-company">{workItems.habee.name}</span>
                    <div className="work-meta">Jan 2026</div>
                    {common(workItems.habee.description)}
                    <div>
                      <ExternalLink href={products.habee.appStore}>
                        View in App Store
                      </ExternalLink>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              variants={sectionChildVariants}
              className="work-item responsive-work-image"
              style={{ marginBottom: "6rem" }}
            >
              <div className="work-content">
                <div className="work-body">
                  <div className="work-image-container">
                    <WorkImage
                      desktop={workItems.ogWalls.desktopImage}
                      mobile={workItems.ogWalls.mobileImage}
                      alt="OG Walls"
                    />
                  </div>
                  <div className="work-text-side">
                    <span className="work-text-company">{workItems.ogWalls.name}</span>
                    <div className="work-meta">Aug 2025</div>
                    {common(workItems.ogWalls.description)}
                    <div>
                      <ExternalLink href={products.ogWalls.store}>
                        View in Play Store
                      </ExternalLink>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              variants={sectionChildVariants} className="work-item" style={{ marginBottom: "6rem" }}>
              <div className="work-content">
                <div className="work-body">
                  <div className="work-image-container">
                    <NotchShelfCarousel />
                  </div>
                  <div className="work-text-side">
                    <span className="work-text-company">
                      <img
                        src={workItems.notchShelf.icon}
                        alt=""
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          verticalAlign: "middle",
                        }}
                      />{" "}
                      NotchShelf
                    </span>
                    <div className="work-meta">Jan 2026</div>
                    {common(workItems.notchShelf.description)}
                    <div
                      className="award-badge-blue"
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setPreview({
                          src: "/media/5c0589_43f2662bccd344f6b5d833dc0ec16ea0~mv2.webp",
                          x: r.left + r.width / 2,
                          y: r.top + r.height / 2,
                        });
                      }}
                      onMouseLeave={() => setPreview(null)}
                      onMouseMove={(e) =>
                        setPreview((p) =>
                          p ? { ...p, x: e.clientX, y: e.clientY } : p,
                        )
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <Award size={12} />
                      <span>#1 Paid App in India - App Store</span>
                    </div>
                    <div>
                      <ExternalLink href={products.notchShelf.appStore.portfolio}>
                        View in App Store
                      </ExternalLink>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>
      {preview &&
        createPortal(
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              left: preview.x,
              top: preview.y,
              transform: "translate(-50%, -50%)",
              zIndex: 20000,
              pointerEvents: "none",
              maxWidth: "90vw",
              maxHeight: "90vh",
              width: "auto",
              height: "auto",
            }}
          >
            <img
              src={preview.src}
              alt="Zoomed preview"
              style={{
                maxWidth: preview.src.includes(
                  "43f2662bccd344f6b5d833dc0ec16ea0",
                )
                  ? 300
                  : "70vw",
                width: "auto",
                height: "auto",
                maxHeight: preview.src.includes(
                  "43f2662bccd344f6b5d833dc0ec16ea0",
                )
                  ? "none"
                  : "80vh",
                borderRadius: 12,
                boxShadow:
                  "0 20px 60px rgba(0,0,0,.3), 0 0 0 1px rgba(0,0,0,.1)",
                background: "#fff",
                border: "1px solid rgba(0,0,0,.1)",
              }}
            />
          </motion.div>,
          document.body,
        )}
    </div>
  );
}
