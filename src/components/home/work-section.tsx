"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Award, MessageSquareText } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CharReveal } from "../motion-text";
import { NotchShelfCarousel } from "../media-interactions";
import { workProjects } from "@/content/work";
import { useMobileViewport } from "@/hooks/use-media-query";
import type {
  PortfolioProject,
  PortfolioProjectAction,
  PortfolioProjectBadge,
} from "@/portfolio/schema";
import { sectionChildVariants, sectionRevealVariants } from "./motion-presets";

type Preview = {
  src: string;
  x: number;
  y: number;
  maxWidth?: number;
};

function WorkImage({ project }: { project: PortfolioProject }) {
  const isMobile = useMobileViewport();
  const image = project.image;
  if (!image) return null;
  const src = isMobile ? image.mobile : image.desktop;
  const dimensions =
    (isMobile ? image.mobileSize : image.desktopSize) ??
    (isMobile ? [2000, 1744] : [2000, 1206]);
  return (
    <img
      src={src}
      alt={image.alt || project.name}
      width={dimensions[0]}
      height={dimensions[1]}
      decoding="async"
      fetchPriority="low"
    />
  );
}

function BookOpenGlyph({ size = 16 }: { size?: number }) {
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

function ActionLink({ action }: { action: PortfolioProjectAction }) {
  const accent = action.tone === "accent";
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: ".4rem",
    textDecoration: "none",
    color: accent ? "var(--color-accent)" : "inherit",
    fontWeight: 500,
    fontSize: ".9rem",
    borderBottom: accent ? "1px solid transparent" : "1px solid currentColor",
    paddingBottom: 2,
    cursor: "pointer",
    ...(accent ? { marginLeft: "1.5rem" } : {}),
  };
  const content = (
    <>
      {action.label}
      {action.icon === "book" ? (
        <BookOpenGlyph size={16} />
      ) : (
        <ArrowUpRight size={16} />
      )}
    </>
  );
  const hoverProps = accent
    ? {
        onMouseOver: (event: React.MouseEvent<HTMLElement>) => {
          event.currentTarget.style.borderBottomColor = "var(--color-accent)";
        },
        onMouseOut: (event: React.MouseEvent<HTMLElement>) => {
          event.currentTarget.style.borderBottomColor = "transparent";
        },
      }
    : {};

  if (action.href.startsWith("/")) {
    return (
      <Link
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
        {...hoverProps}
      >
        {content}
      </Link>
    );
  }
  return (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      style={style}
      {...hoverProps}
    >
      {content}
    </a>
  );
}

function BadgeContent({ badge }: { badge: PortfolioProjectBadge }) {
  return (
    <>
      <Award size={12} />
      <span>{badge.text}</span>
    </>
  );
}

function ProjectBadge({
  badge,
  mobile,
  onPreview,
}: {
  badge: PortfolioProjectBadge;
  mobile: boolean;
  onPreview: (event: React.MouseEvent<HTMLElement>, badge: PortfolioProjectBadge) => void;
}) {
  const className =
    badge.tone === "blue"
      ? "award-badge-blue"
      : "award-badge shimmer-badge";
  const previewProps = badge.previewImage
    ? {
        onMouseEnter: (event: React.MouseEvent<HTMLElement>) =>
          onPreview(event, badge),
        onMouseMove: (event: React.MouseEvent<HTMLElement>) =>
          onPreview(event, badge),
      }
    : {};

  if (badge.href) {
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: mobile ? "center" : "flex-start",
        }}
      >
        <a
          className={className}
          href={badge.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BadgeContent badge={badge} />
        </a>
      </div>
    );
  }

  return (
    <div
      className={className}
      {...previewProps}
      style={badge.previewImage ? { cursor: "pointer" } : undefined}
    >
      <BadgeContent badge={badge} />
    </div>
  );
}

function StoryBlock({
  project,
  setPreview,
}: {
  project: PortfolioProject;
  setPreview: React.Dispatch<React.SetStateAction<Preview | null>>;
}) {
  const story = project.story;
  if (!story) return null;
  const dimensions = story.imageSize ?? [2000, 547];
  return (
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
          {story.title}
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
          onMouseEnter={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setPreview({
              src: story.image,
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            });
          }}
          onMouseLeave={() => setPreview(null)}
          onMouseMove={(event) =>
            setPreview((current) =>
              current
                ? { ...current, x: event.clientX, y: event.clientY }
                : current,
            )
          }
          style={{ position: "relative", display: "inline-block" }}
        >
          <img
            src={story.image}
            alt={story.imageAlt}
            width={dimensions[0]}
            height={dimensions[1]}
            decoding="async"
            fetchPriority="low"
            style={{
              width: "100%",
              height: "auto",
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
          {story.body}
        </motion.p>
      </div>
    </motion.div>
  );
}

function ProjectMedia({ project }: { project: PortfolioProject }) {
  if (project.layout === "carousel" && project.carouselImages?.length) {
    return <NotchShelfCarousel images={project.carouselImages} />;
  }
  return <WorkImage project={project} />;
}

function ProjectCard({
  project,
  mobile,
  setPreview,
}: {
  project: PortfolioProject;
  mobile: boolean;
  setPreview: React.Dispatch<React.SetStateAction<Preview | null>>;
}) {
  const classes = ["work-item"];
  if (project.image) classes.push("responsive-work-image");
  if (project.featuredOnMobile) {
    classes.push("mobile-featured-work", `mobile-work-${project.id}`);
  }
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
  const onPreview = (
    event: React.MouseEvent<HTMLElement>,
    badge: PortfolioProjectBadge,
  ) => {
    if (!badge.previewImage) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPreview({
      src: badge.previewImage,
      x: event.clientX || rect.left + rect.width / 2,
      y: event.clientY || rect.top + rect.height / 2,
      maxWidth: badge.previewMaxWidth,
    });
  };

  return (
    <motion.div
      variants={sectionChildVariants}
      className={classes.join(" ")}
      style={{ marginBottom: "6rem" }}
    >
      <div className="work-content">
        <div className="work-body">
          <div className="work-image-container">
            <ProjectMedia project={project} />
          </div>
          <div className="work-text-side">
            <span className="work-text-company">
              {project.icon && (
                <img
                  src={project.icon}
                  alt=""
                  decoding="async"
                  fetchPriority="low"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    verticalAlign: "middle",
                  }}
                />
              )}
              {project.name}
            </span>
            <div className="work-meta">{project.date}</div>
            {common(project.description)}
            {project.badge && (
              <ProjectBadge badge={project.badge} mobile={mobile} onPreview={onPreview} />
            )}
            {project.actions?.length ? (
              <div>
                {project.actions.map((action) => (
                  <ActionLink key={`${project.id}-${action.label}`} action={action} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {project.layout === "story" && (
          <StoryBlock project={project} setPreview={setPreview} />
        )}
      </div>
    </motion.div>
  );
}

export function WorkSection() {
  const mobile = useMobileViewport();
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    const preload = workProjects.flatMap((project) => [
      project.story?.image,
      project.badge?.previewImage,
    ]).filter((src): src is string => Boolean(src));
    preload.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, []);

  if (!workProjects.length) return null;

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
            {workProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                mobile={mobile}
                setPreview={setPreview}
              />
            ))}
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
                maxWidth: preview.maxWidth ?? "70vw",
                width: "auto",
                height: "auto",
                maxHeight: preview.maxWidth ? "none" : "80vh",
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
