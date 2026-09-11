"use client";

import Link from "next/link";
import Image, { getImageProps } from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight, Award, MessageSquareText } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CharReveal } from "../motion-text";
import { MediaCarousel } from "../media/media-carousel";
import { workProjects } from "@/content/work";
import { useMobileViewport } from "@/hooks/use-media-query";
import type {
  PortfolioProject,
  PortfolioProjectAction,
  PortfolioProjectBadge,
  PortfolioProjectImage,
} from "@/portfolio/schema";
import { sectionChildVariants, sectionRevealVariants } from "./motion-presets";
import { mediaDimensions } from "@/portfolio/media";

type Preview = {
  src: string;
  x: number;
  y: number;
  maxWidth?: number;
};

function WorkImage({
  image,
  projectName,
}: {
  image: PortfolioProjectImage;
  projectName: string;
}) {
  const dimensions = mediaDimensions(image.src);
  const common = {
    alt: image.alt || projectName,
    sizes: "(max-width: 768px) 100vw, 60vw",
  };
  const { props } = getImageProps({ ...common, src: image.src, ...dimensions });
  const mobile = image.mobile
    ? getImageProps({
        ...common,
        src: image.mobile,
        ...mediaDimensions(image.mobile),
      }).props
    : null;
  return (
    <picture>
      {mobile && (
        <source
          media="(max-width: 767px)"
          srcSet={mobile.srcSet}
          sizes={mobile.sizes}
          width={mobile.width}
          height={mobile.height}
        />
      )}
      <img {...props} alt={common.alt} />
    </picture>
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
  const newTab = action.newTab ?? !action.href.startsWith("/");
  const tabProps = newTab
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  if (action.href.startsWith("/")) {
    return (
      <Link href={action.href} {...tabProps} style={style} {...hoverProps}>
        {content}
      </Link>
    );
  }
  return (
    <a href={action.href} {...tabProps} style={style} {...hoverProps}>
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
  onPreviewEnd,
}: {
  badge: PortfolioProjectBadge;
  mobile: boolean;
  onPreview: (
    event: React.MouseEvent<HTMLElement>,
    badge: PortfolioProjectBadge,
  ) => void;
  onPreviewEnd: () => void;
}) {
  const className =
    badge.tone === "blue" ? "award-badge-blue" : "award-badge shimmer-badge";
  const previewProps = badge.previewImage
    ? {
        onMouseEnter: (event: React.MouseEvent<HTMLElement>) =>
          onPreview(event, badge),
        onMouseMove: (event: React.MouseEvent<HTMLElement>) =>
          onPreview(event, badge),
        onMouseLeave: onPreviewEnd,
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
  const dimensions = mediaDimensions(story.image);
  return (
    <motion.div
      initial={false}
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
          <Image
            src={story.image}
            alt={story.imageAlt}
            {...dimensions}
            sizes="(max-width: 768px) 100vw, 400px"
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
          initial={false}
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
  const isMobile = useMobileViewport();
  if (project.media.kind === "carousel") {
    const slides = project.media.images.map((slide) => ({
      src: isMobile ? (slide.mobile ?? slide.src) : slide.src,
      alt: slide.alt,
    }));
    return <MediaCarousel images={slides} />;
  }
  return <WorkImage image={project.media.image} projectName={project.name} />;
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
  const previewFrame = useRef<number | null>(null);
  const classes = ["work-item"];
  if (project.media.kind === "image") classes.push("responsive-work-image");
  if (project.media.kind === "carousel") classes.push("work-carousel-enabled");
  if (project.mobileTreatment === "featured") {
    classes.push("mobile-featured-work", `mobile-work-${project.id}`);
  }

  useEffect(
    () => () => {
      if (previewFrame.current !== null) {
        window.cancelAnimationFrame(previewFrame.current);
      }
    },
    [],
  );

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
    const next = {
      src: badge.previewImage,
      x: event.clientX || rect.left + rect.width / 2,
      y: event.clientY || rect.top + rect.height / 2,
      maxWidth: badge.previewMaxWidth,
    };
    if (previewFrame.current !== null) {
      window.cancelAnimationFrame(previewFrame.current);
    }
    previewFrame.current = window.requestAnimationFrame(() => {
      previewFrame.current = null;
      setPreview(next);
    });
  };
  const onPreviewEnd = () => {
    if (previewFrame.current !== null) {
      window.cancelAnimationFrame(previewFrame.current);
      previewFrame.current = null;
    }
    setPreview(null);
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
                <Image
                  src={project.icon}
                  alt=""
                  width={24}
                  height={24}
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
              <ProjectBadge
                badge={project.badge}
                mobile={mobile}
                onPreview={onPreview}
                onPreviewEnd={onPreviewEnd}
              />
            )}
            {project.actions?.length ? (
              <div>
                {project.actions.map((action) => (
                  <ActionLink
                    key={`${project.id}-${action.label}`}
                    action={action}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {project.story && (
          <StoryBlock project={project} setPreview={setPreview} />
        )}
      </div>
    </motion.div>
  );
}

export function WorkSection() {
  const mobile = useMobileViewport();
  const [preview, setPreview] = useState<Preview | null>(null);

  if (!workProjects.length) return null;

  return (
    <div className="container">
      <section id="work">
        <motion.div
          variants={sectionRevealVariants}
          initial={false}
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="section-inner"
        >
          <motion.div
            variants={sectionChildVariants}
            style={{ marginBottom: "4rem" }}
          >
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
