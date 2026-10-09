"use client";

import { useRefractData } from "../data-context";

import type { StylePreset } from "@/components/refract/lib/scene-theme";
import { NorthEastIcon, PlaybackIcon } from "./Icons";
import { SiteHeader } from "./SiteHeader";
import { HeroText } from "./HeroText";
import { FeaturedLink } from "./FeaturedLink";
import { SceneTimeline } from "./SceneTimeline";
import { ResearchFigure } from "./ResearchFigure";
import { SceneFallback } from "./SceneFallback";
import { usePortfolioScene } from "./usePortfolioScene";

export function PortfolioExperience({
  stylePreset = "dark",
}: {
  stylePreset?: StylePreset;
}) {
  const {
    copy,
    profile,
    researchProjects,
    links,
    tools,
    siteConfig,
    sceneContact,
  } = useRefractData();
  const projectHeading = researchProjects.length
    ? siteConfig.projectHeading
    : copy.overview;
  const count = String(researchProjects.length).padStart(2, "0");
  const {
    root,
    canvas,
    timeline,
    active,
    chapter,
    paused,
    loaded,
    introText,
    reduced,
    setPaused,
    learnMore,
    seekPosition,
    refreshScene,
    chapterLabels,
    figures,
  } = usePortfolioScene(stylePreset);

  return (
    <div
      className={`portfolio-experience ${paused ? "motion-paused" : ""}`}
      data-intro="pending"
      data-nav-visible="false"
      ref={root}
    >
      <div className="reference-stage" aria-hidden="true">
        <canvas ref={canvas} />
        {!loaded && (
          <div className="loading-dots">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        )}
      </div>

      <section id="home" className="intro-chapter" data-scene-chapter="intro">
        <SiteHeader />
        <div className="intro-page page-width">
          <HeroText paused={paused} reduced={reduced} entrance={introText} />
          <div className="intro-footer">
            <div className="intro-links">
              <a href={siteConfig.hero.contactHref}>
                {siteConfig.hero.contactLabel}
                <NorthEastIcon />
              </a>
              <a
                className="learn-more"
                href={siteConfig.hero.learnHref}
                onClick={learnMore}
              >
                {siteConfig.hero.learnLabel}
                <span className="learn-more-arrows" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M12 5v13m-5-5 5 5 5-5" />
                  </svg>
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M12 5v13m-5-5 5 5 5-5" />
                  </svg>
                </span>
              </a>
            </div>
            <FeaturedLink link={siteConfig.hero.featuredLink} />
          </div>
        </div>
      </section>

      <section
        id="overview"
        className="anatomy-chapter"
        data-scene-chapter="anatomy"
        aria-label={projectHeading}
      >
        <div className="fixed-copy page-width" data-fixed-copy="anatomy">
          <div className="reference-text" data-mobile-panel="copy">
            <h2>{projectHeading}</h2>
            <p>{profile.summary}</p>
          </div>
        </div>
      </section>

      <div id="work" className="feature-gallery">
        {researchProjects.map((project, i) => (
          <section
            key={project.id}
            id={`refract-project-${project.id}`}
            className={`feature-chapter ${active === i ? "is-active" : ""}`}
            style={
              {
                "--accent": [
                  "var(--accent-red)",
                  "var(--accent-orange)",
                  "var(--accent-green)",
                  "var(--accent-cyan)",
                ][i % 4],
              } as import("react").CSSProperties
            }
            data-scene-chapter={`research-${i}`}
          >
            <div className="page-width feature-content">
              <div className="reference-text" data-mobile-panel="copy">
                <div className="feature-index">
                  <span aria-hidden="true">
                    <b>{String(i + 1).padStart(2, "0")}</b> / {count}
                  </span>
                  <span>{project.meta}</span>
                </div>
                <h2>{project.title}</h2>
                <p>{project.description}</p>
                {project.url && (
                  <div className="feature-links">
                    <a
                      href={project.url}
                      target={
                        project.url.startsWith("http") ? "_blank" : undefined
                      }
                      rel="noopener noreferrer"
                    >
                      {project.linkLabel}
                      <NorthEastIcon />
                    </a>
                  </div>
                )}
              </div>
              {figures[i] && (
                <ResearchFigure
                  project={project}
                  definition={figures[i]}
                  active={active === i}
                  playing={!paused && !reduced}
                />
              )}
            </div>
          </section>
        ))}
      </div>

      <section
        className="modules-chapter"
        data-scene-chapter="tools"
        data-empty={tools.length === 0}
      >
        <span id="tools" className="tools-anchor" aria-hidden="true" />
        <div className="fixed-copy page-width" data-fixed-copy="tools">
          <div
            className="reference-text"
            data-mobile-panel={tools.length > 0 ? "copy" : undefined}
          >
            {tools.length > 0 && <h2>{siteConfig.toolsHeading}</h2>}
            {tools.map((tool) => (
              <div className="scene-tool" key={tool.id}>
                <h3>
                  {tool.url ? (
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {tool.name}
                      <NorthEastIcon />
                    </a>
                  ) : (
                    tool.name
                  )}
                </h3>
                <p>{tool.description}</p>
                <div className="scene-tool-links">
                  {tool.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                      <NorthEastIcon />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="exit-chapter"
        data-scene-chapter="exit"
        aria-label={copy.contact}
      >
        {sceneContact && (
          <div
            className="fixed-copy centered-copy page-width"
            data-fixed-copy="exit"
          >
            <h2>{copy.contact}</h2>
            <a href={links.email}>
              {profile.email}
              <NorthEastIcon />
            </a>
          </div>
        )}
      </section>

      <button
        className="motion-button"
        type="button"
        onClick={() => setPaused(!paused)}
        aria-label={paused ? copy.resumeAnimation : copy.pauseAnimation}
        aria-pressed={paused}
      >
        <PlaybackIcon paused={paused} />
        <span>{paused ? copy.resumeAnimation : copy.pauseAnimation}</span>
      </button>
      <div className="reference-navigation">
        <SceneTimeline
          ref={timeline}
          labels={chapterLabels}
          name={copy.pageChapters}
          chapter={chapter}
          onSeek={seekPosition}
          onRelease={() => refreshScene.current()}
        />
      </div>
      <SceneFallback />
    </div>
  );
}
