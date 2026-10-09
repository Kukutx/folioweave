"use client";

import { useRefractData } from "../data-context";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { animate, createSpring } from "animejs";
import type { EarthRenderer } from "@/components/refract/lib/earth-renderer";
import type { ReadingBounds } from "@/components/refract/lib/scene-camera";
import { clamp, smooth } from "@/components/refract/lib/motion";
import {
  sceneBackground,
  sceneForeground,
  sceneLight,
  type StylePreset,
} from "@/components/refract/lib/scene-theme";
import type { SceneTimelineHandle } from "./SceneTimeline";
import {
  chapterRanges,
  chapterScrollPosition,
  heroSpinLimit,
  locateChapter,
  readingPanel,
  sceneLayout,
  sceneProgress,
  toolsCopyOpacity,
} from "@/components/refract/lib/scene-progress";

/**
 * One controller for chapter progress, scene rendering and the introductory clock.
 * Keep measurements outside scroll updates; content and layout live in the view.
 */
export function usePortfolioScene(stylePreset: StylePreset) {
  const { copy, profile, researchProjects, siteConfig, tools } =
    useRefractData();
  const { chapterLabels, figures, bounds, toolsIndex, continentalDrift } =
    useMemo(() => {
      const bounds = chapterRanges(researchProjects.length);
      const { enabled, chapters, ...drift } =
        siteConfig.effects.continentalDrift;
      const projectRanges = bounds.slice(2, 2 + researchProjects.length);
      return {
        chapterLabels: [
          copy.home,
          siteConfig.projectHeading,
          ...researchProjects.map((project) => project.title),
          tools.length ? siteConfig.toolsHeading : copy.transition,
          copy.contact,
        ],
        figures: researchProjects.map(
          (project) => siteConfig.researchFigures[project.id],
        ),
        bounds,
        toolsIndex: researchProjects.length + 2,
        continentalDrift:
          enabled && projectRanges.length
            ? {
                ...drift,
                ranges:
                  chapters === "first"
                    ? projectRanges.slice(0, 1)
                    : projectRanges,
              }
            : (false as const),
      };
    }, [copy, researchProjects, siteConfig, tools.length]);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const earth = useRef<EarthRenderer | null>(null);
  const currentProgress = useRef(0);
  const timeline = useRef<SceneTimelineHandle>(null);
  const refreshScene = useRef(() => {});
  const seekScroll = useRef<(position: number) => void>(() => {});
  const pausedRef = useRef(false);
  const navigationMotion = useRef<ReturnType<typeof animate> | null>(null);
  const [active, setActive] = useState(-1);
  const [chapter, setChapter] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [introText, setIntroText] = useState<"waiting" | "animate" | "static">(
    "waiting",
  );
  const [reduced, setReduced] = useState(false);
  const activeRef = useRef(-1);

  useEffect(() => {
    const container = root.current;
    const surface = canvas.current;
    if (!container || !surface) return;
    let disposed = false;
    const preference = window.matchMedia(sceneLayout.reducedQuery);
    setReduced(preference.matches);
    setPaused(preference.matches);
    pausedRef.current = preference.matches;
    const sections = Array.from(
      container.querySelectorAll<HTMLElement>("[data-scene-chapter]"),
    );
    const fixedText = Array.from(
      container.querySelectorAll<HTMLElement>("[data-fixed-copy]"),
    );
    const navigation = container.querySelector<HTMLElement>(
      ".reference-navigation",
    )!;
    const stage = container.querySelector<HTMLElement>(".reference-stage")!;
    const introCopy = container.querySelector<HTMLElement>(".intro-text")!;
    const introFooter = container.querySelector<HTMLElement>(".intro-footer")!;
    const header = container.querySelector<HTMLElement>(".site-header")!;
    const mobilePanels = sections.map((section) =>
      Array.from(section.querySelectorAll<HTMLElement>("[data-mobile-panel]")),
    );
    let containerTop = 0,
      introBottom = 0;
    let viewportWidth = window.innerWidth,
      viewportHeight = window.innerHeight,
      mobileRadiusLimit = Infinity;
    let measuredReduced = preference.matches;
    let headerHeight = 72,
      footerClearance = 134,
      documentDistance = 1;
    let previousChapter = -1,
      previousColor = "",
      previousNavigation: boolean | undefined;
    const intro = { progress: 0 };
    let entrance: ReturnType<typeof animate> | undefined;
    let introFinished = false,
      copyStarted = false;
    let previousStageOpacity = "";
    let previousFooter = "";
    const copyOpacities = new Map<HTMLElement, string>();
    const panelStates = new WeakMap<HTMLElement, string>();
    let sizes: { start: number; end: number }[] = [];
    type ReadingPosition = { index: number; local: number; hash: string };
    let readingPosition: ReadingPosition | null = null;
    let pendingPreferencePosition: ReadingPosition | null = null;
    let toolsBounds: ReadingBounds | null = null;
    let distance = 1;
    const measure = () => {
      const top = container.getBoundingClientRect().top;
      containerTop = window.scrollY + top;
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      measuredReduced = preference.matches;
      const toolsCopy = container.querySelector<HTMLElement>(
        '[data-fixed-copy="tools"] .reference-text',
      );
      toolsBounds = null;
      if (toolsCopy && viewportWidth >= sceneLayout.desktop) {
        const walker = document.createTreeWalker(
          toolsCopy,
          NodeFilter.SHOW_TEXT,
        );
        const range = document.createRange();
        const lines: ReadingBounds[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim()) continue;
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (!rect.width || !rect.height) continue;
            lines.push({
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
            });
          }
        }
        if (lines.length)
          toolsBounds = {
            left: Math.min(...lines.map((line) => line.left)),
            right: Math.max(...lines.map((line) => line.right)),
            top: Math.min(...lines.map((line) => line.top)),
            bottom: Math.max(...lines.map((line) => line.bottom)),
            lines,
          };
      }
      earth.current?.setToolsBounds(toolsBounds);
      const controlInset =
        parseFloat(getComputedStyle(navigation).bottom) || 16;
      headerHeight = header.offsetHeight;
      const footerInset =
        parseFloat(getComputedStyle(introFooter).bottom) || 16;
      const featuredCaption = introFooter.querySelector<HTMLElement>(
        ".featured-link>span",
      );
      footerClearance =
        footerInset +
        introFooter.offsetHeight +
        (viewportWidth >= sceneLayout.mobile && featuredCaption
          ? featuredCaption.offsetHeight + 8
          : 0);
      documentDistance = Math.max(
        1,
        document.documentElement.scrollHeight - viewportHeight,
      );
      mobileRadiusLimit = Math.max(
        32,
        (viewportHeight / 2 - controlInset - navigation.offsetHeight - 16) /
          1.3,
      );
      introBottom =
        introCopy.getBoundingClientRect().bottom +
        window.scrollY -
        containerTop;
      sizes = sections.map((section) => {
        const rect = section.getBoundingClientRect();
        return { start: rect.top - top, end: rect.bottom - top };
      });
      distance = Math.max(1, container.offsetHeight - window.innerHeight);
    };
    measure();

    // The opening globe can be turned by hand: a horizontal drag adds yaw, and
    // letting go carries its momentum to the nearest whole turn, which is the
    // same pose the scene would have shown untouched.
    const globe = { centerY: viewportHeight * 0.5, radius: 0 };
    const turn = {
      pointer: null as number | null,
      yaw: 0,
      startX: 0,
      startYaw: 0,
      samples: [] as { x: number; time: number }[],
      settle: null as ReturnType<typeof animate> | null,
    };
    const turnable = () =>
      introFinished &&
      !preference.matches &&
      !pausedRef.current &&
      currentProgress.current <= heroSpinLimit;
    const overGlobe = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      return (
        Math.hypot(
          event.clientX - rect.left - rect.width / 2,
          event.clientY - rect.top - globe.centerY,
        ) <=
        globe.radius * 1.12
      );
    };
    const applyTurn = () => earth.current?.setSpin(turn.yaw);
    const releaseTurn = () => {
      if (turn.pointer === null) return;
      if (container.hasPointerCapture(turn.pointer))
        container.releasePointerCapture(turn.pointer);
      turn.pointer = null;
      delete container.dataset.globeTurn;
      const [first, last] = [turn.samples[0], turn.samples.at(-1)];
      const elapsed = first && last ? last.time - first.time : 0;
      const velocity =
        elapsed > 16
          ? ((last!.x - first!.x) / Math.max(1, globe.radius) / elapsed) * 1000
          : 0;
      const target =
        Math.round((turn.yaw + clamp(velocity, -9, 9) * 0.3) / (Math.PI * 2)) *
        Math.PI *
        2;
      turn.settle = animate(turn, {
        yaw: target,
        ease: createSpring({ stiffness: 46, damping: 10 }),
        onUpdate: applyTurn,
        onComplete: () => {
          turn.yaw = 0;
          applyTurn();
        },
      });
    };
    const startTurn = (event: PointerEvent) => {
      if (
        turn.pointer !== null ||
        event.button !== 0 ||
        !turnable() ||
        (event.target as Element).closest("a, button, nav, input") ||
        !overGlobe(event)
      )
        return;
      turn.settle?.pause();
      turn.pointer = event.pointerId;
      turn.startX = event.clientX;
      turn.startYaw = turn.yaw;
      turn.samples = [{ x: event.clientX, time: event.timeStamp }];
      container.setPointerCapture(event.pointerId);
      container.dataset.globeTurn = "active";
      // Keep the drag from selecting the page's text.
      if (event.pointerType === "mouse") event.preventDefault();
    };
    const moveTurn = (event: PointerEvent) => {
      if (turn.pointer !== event.pointerId) {
        if (turn.pointer === null && event.pointerType === "mouse") {
          const ready = turnable() && overGlobe(event);
          if ((container.dataset.globeTurn === "ready") !== ready) {
            if (ready) container.dataset.globeTurn = "ready";
            else delete container.dataset.globeTurn;
          }
        }
        return;
      }
      turn.yaw =
        turn.startYaw +
        (event.clientX - turn.startX) / Math.max(1, globe.radius);
      turn.samples.push({ x: event.clientX, time: event.timeStamp });
      while (
        turn.samples.length > 2 &&
        event.timeStamp - turn.samples[0].time > 90
      )
        turn.samples.shift();
      applyTurn();
    };
    const endTurn = (event: PointerEvent) => {
      if (turn.pointer === event.pointerId) releaseTurn();
    };
    container.addEventListener("pointerdown", startTurn);
    container.addEventListener("pointermove", moveTurn);
    container.addEventListener("pointerup", endTurn);
    container.addEventListener("pointercancel", endTurn);

    const update = (raw: number) => {
      const readingPhases = viewportWidth < sceneLayout.desktop;
      const y = clamp(raw) * distance + 0.5;
      const { index, local } = locateChapter(y - 0.5, sizes, distance);
      readingPosition =
        window.scrollY >= containerTop &&
        window.scrollY <= containerTop + distance
          ? { index, local, hash: location.hash }
          : null;
      const p = sceneProgress(
        index,
        local,
        bounds,
        readingPhases,
        Boolean(figures[index - 2]),
      );
      currentProgress.current = p;
      // Reference heading-links: fixed at the foot, then travels down 200px.
      // Reference HEADING: 250ms / 200px travel, opacity begins at 150ms
      // and ends at 300ms, inside its 1080ms, three-viewport introduction.
      const headingTime =
        (Math.max(0, y - 0.5) /
          Math.max(1, viewportHeight * 3 - headerHeight)) *
        1080;
      const footerExit = preference.matches
        ? Number(headingTime > 150)
        : clamp(headingTime / 250);
      const footerOpacity = preference.matches
        ? 1 - footerExit
        : 1 - clamp((headingTime - 150) / 150);
      const uiReady = intro.progress >= 0.63;
      const dragging = Boolean(timeline.current?.isDragging());
      const footerInert =
        dragging ||
        footerOpacity < 0.01 ||
        !uiReady ||
        footerExit * 200 >= footerClearance;
      const footerKey = `${footerExit}/${footerOpacity}/${footerInert}`;
      if (previousFooter !== footerKey) {
        previousFooter = footerKey;
        introFooter.style.setProperty(
          "--intro-exit-y",
          `${footerExit * 200}px`,
        );
        introFooter.style.opacity = String(footerOpacity);
        introFooter.style.visibility =
          footerOpacity < 0.001 ? "hidden" : "visible";
        introFooter.inert = footerInert;
      }
      if (header.inert !== !uiReady) header.inert = !uiReady;
      const footerCleared =
        uiReady &&
        (footerExit * 200 >= footerClearance || footerOpacity < 0.001);
      if (container.dataset.footerCleared !== String(footerCleared))
        container.dataset.footerCleared = String(footerCleared);
      // Chapter visibility and the decorative scene follow the same document position.
      const actualY = clamp(window.scrollY - containerTop, 0, distance) + 0.5;
      const { index: visibleIndex } = locateChapter(
        actualY - 0.5,
        sizes,
        distance,
      );
      if (viewportWidth < sceneLayout.mobile) {
        // A stable viewport stage: reading order never moves the globe's center.
        const radius = Math.min(
          viewportWidth * 0.355,
          viewportHeight * 0.275,
          mobileRadiusLimit,
        );
        const heroTop = introBottom + 24,
          heroBottom = viewportHeight - 88;
        const heroRadius = Math.max(
          32,
          Math.min(viewportWidth * 0.355, (heroBottom - heroTop) / 2.55),
        );
        const heroCenter = clamp(
          viewportHeight * 0.5,
          heroTop + heroRadius * 1.27,
          heroBottom - heroRadius * 1.27,
        );
        const centered = index === 0 ? smooth(0, 0.16, local) : 1;
        const landscape = viewportWidth >= 600 && viewportHeight < 600;
        const layout = {
          centerY: landscape
            ? viewportHeight * 0.5
            : heroCenter + (viewportHeight * 0.5 - heroCenter) * centered,
          radius: landscape
            ? Math.min(viewportWidth * 0.17, radius)
            : heroRadius + (radius - heroRadius) * centered,
        };
        globe.centerY = layout.centerY;
        globe.radius = layout.radius;
        earth.current?.setMobileLayout(layout);
      } else {
        globe.centerY = viewportHeight * 0.5;
        globe.radius = Math.min(
          viewportWidth * 0.28,
          viewportHeight * 0.31,
          306,
        );
        earth.current?.setMobileLayout(null);
      }
      // Scrolling on takes the globe back from the reader's hand.
      if (turn.pointer !== null && p > heroSpinLimit) releaseTurn();
      earth.current?.setProgress(p);
      const light = sceneLight(p, stylePreset);
      const color = sceneBackground(light, stylePreset, intro.progress);
      if (previousColor !== color) {
        previousColor = color;
        container.style.setProperty("--scene-background", color);
        container.style.setProperty(
          "--scene-foreground",
          sceneForeground(light),
        );
        container.dataset.tone = light > 0.5 ? "light" : "dark";
      }
      const chapterPosition = (index + local) / sections.length;
      timeline.current?.setPosition(chapterPosition);
      const actualProgress = window.scrollY / documentDistance;
      const navVisible =
        dragging ||
        (footerCleared && actualProgress > 0.02 && actualY / distance < 0.98);
      if (previousNavigation !== navVisible) {
        previousNavigation = navVisible;
        container.dataset.navVisible = String(navVisible);
        navigation.inert = !navVisible;
      }
      const narrativeIndex = readingPhases ? index : visibleIndex;
      const next =
        narrativeIndex >= 2 && narrativeIndex < toolsIndex
          ? narrativeIndex - 2
          : -1;
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
      }
      if (previousChapter !== visibleIndex) {
        previousChapter = visibleIndex;
        setChapter(visibleIndex);
        container.dataset.inResearch = next >= 0 ? "true" : "false";
        container.dataset.chapter = String(visibleIndex);
      }
      let mobileStage = 1;
      mobilePanels.forEach((panels, sectionIndex) =>
        panels.forEach((panel) => {
          if (!readingPhases) {
            if (panelStates.get(panel) === "desktop") return;
            panelStates.set(panel, "desktop");
            panel.style.removeProperty("--mobile-opacity");
            panel.style.removeProperty("--mobile-shift");
            panel.style.removeProperty("visibility");
            panel.inert = false;
            return;
          }
          const phase = index + local - sectionIndex;
          const { envelope, opacity, shift } = readingPanel(
            phase,
            panel.dataset.mobilePanel === "figure",
            preference.matches,
          );
          mobileStage *= 1 - envelope;
          const key = `${opacity}/${shift}`;
          if (panelStates.get(panel) === key) return;
          panelStates.set(panel, key);
          panel.style.setProperty("--mobile-opacity", String(opacity));
          panel.style.setProperty("--mobile-shift", `${shift}px`);
          panel.style.visibility = opacity > 0.001 ? "visible" : "hidden";
          panel.inert = opacity < 0.5;
        }),
      );
      const stageOpacity = String((1 - smooth(0.98, 1, p)) * mobileStage);
      if (previousStageOpacity !== stageOpacity) {
        previousStageOpacity = stageOpacity;
        stage.style.opacity = stageOpacity;
      }
      // Reading phases hide the stage entirely. Pausing alone still redraws on
      // every progress update; suspend that work and retain the newest pose.
      earth.current?.setSuspended(Number(stageOpacity) < 0.001);
      earth.current?.setPaused(pausedRef.current);
      fixedText.forEach((copy) => {
        const name = copy.dataset.fixedCopy;
        if (readingPhases && (name === "anatomy" || name === "tools")) {
          if (copyOpacities.get(copy) === "reading") return;
          copyOpacities.set(copy, "reading");
          copy.style.opacity = "1";
          copy.style.visibility = "visible";
          copy.inert = false;
          return;
        }
        const opacity =
          name === "anatomy"
            ? visibleIndex < 2
              ? smooth(0.15, 0.24, p) * (1 - smooth(0.35, 0.415, p))
              : 0
            : name === "tools"
              ? visibleIndex === toolsIndex
                ? toolsCopyOpacity(p)
                : 0
              : visibleIndex === toolsIndex + 1
                ? smooth(0.955, 0.98, p) * (1 - smooth(0.995, 1, p))
                : 0;
        const opacityValue = String(opacity);
        if (copyOpacities.get(copy) === opacityValue) return;
        copyOpacities.set(copy, opacityValue);
        copy.style.opacity = opacityValue;
        copy.style.visibility = opacity > 0.01 ? "visible" : "hidden";
        copy.inert = opacity < 0.5;
      });
    };
    const updateFromScroll = () =>
      update(clamp((window.scrollY - containerTop) / distance));
    refreshScene.current = updateFromScroll;
    seekScroll.current = (position) =>
      window.scrollTo({
        top: containerTop + chapterScrollPosition(position, sizes, distance),
        behavior: "instant",
      });
    // Sample actual document position once per frame. The stage may already be
    // outside an observer's cached range after orientation changes or anchor
    // jumps; native scroll still delivers both endpoints without a stale proxy.
    let scrollFrame = 0;
    const onScroll = () => {
      if (!scrollFrame)
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0;
          updateFromScroll();
        });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    updateFromScroll();
    const paintIntro = () => {
      earth.current?.setIntroProgress(intro.progress);
      container.style.setProperty(
        "--intro-ui-opacity",
        String(smooth(0.63, 0.75, intro.progress)),
      );
      if (intro.progress >= 0.46 && !copyStarted) {
        copyStarted = true;
        setIntroText(introFinished ? "static" : "animate");
      }
      updateFromScroll();
    };
    const finishIntro = () => {
      if (disposed || introFinished) return;
      introFinished = true;
      entrance?.pause();
      intro.progress = 1;
      container.dataset.intro = "complete";
      setIntroText("static");
      copyStarted = true;
      paintIntro();
    };
    // Scroll restoration, interaction and reduced motion must never wait for a loader.
    const skipOnScroll = () => {
      if (window.scrollY > 16) finishIntro();
    };
    const fallback = window.setTimeout(finishIntro, 6000);
    window.addEventListener("scroll", skipOnScroll, { passive: true });
    if (
      preference.matches ||
      window.scrollY > 16 ||
      (location.hash && location.hash !== "#home")
    )
      finishIntro();
    let fontDeadline: number;
    const fontReady = new Promise<void>((resolve) => {
      fontDeadline = window.setTimeout(resolve, 1200);
      document.fonts.ready.then(() => {
        window.clearTimeout(fontDeadline);
        resolve();
      });
    });
    Promise.all([
      import("@/components/refract/lib/earth-runtime"),
      import("@/components/refract/lib/land-points.json"),
      fontReady,
    ])
      .then(async ([renderer, points]) => {
        if (disposed) return;
        measure();
        const instance = await renderer.createEarthRuntime(surface, {
          landPoints: points.default,
          reducedMotion: preference.matches,
          style: stylePreset,
          projectCount: researchProjects.length,
          introProgress: intro.progress,
          fracturedGlass: siteConfig.effects.fracturedGlass,
          continentalDrift,
          layerLabels: siteConfig.layerLabels,
          location: { label: profile.location, ...profile.coordinates },
        });
        if (disposed) {
          instance.destroy();
          return;
        }
        earth.current = instance;
        earth.current.setToolsBounds(toolsBounds);
        earth.current.setProgress(currentProgress.current);
        earth.current.setPaused(pausedRef.current);
        setLoaded(true);
        updateFromScroll();
        if (!introFinished) {
          container.dataset.intro = "running";
          entrance = animate(intro, {
            progress: [0, 1],
            duration: 3000,
            ease: "linear",
            onUpdate: paintIntro,
            onComplete: () => {
              introFinished = true;
              container.dataset.intro = "complete";
              window.clearTimeout(fallback);
            },
          });
        }
      })
      .catch(() => {
        if (!disposed) {
          setLoaded(true);
          finishIntro();
        }
      });
    const resize = (preservePosition = false) => {
      if (disposed) return;
      // Some browsers notify matchMedia before the corresponding CSS layout.
      // Keep its reading anchor until ResizeObserver sees the actual new bounds.
      if (measuredReduced !== preference.matches)
        pendingPreferencePosition = readingPosition;
      const position = pendingPreferencePosition ?? readingPosition;
      const oldSizes = sizes,
        oldDistance = distance;
      // ResizeObserver may run before the viewport/media-query event. Whichever
      // observer sees the new layout first owns the position remapping.
      const responsiveChange =
        preservePosition ||
        pendingPreferencePosition !== null ||
        viewportWidth !== window.innerWidth ||
        viewportHeight !== window.innerHeight ||
        measuredReduced !== preference.matches;
      measure();
      // Viewport and motion-preference changes alter chapter heights. Preserve
      // the reader's chapter/local position instead of reinterpreting the old
      // pixel offset as a different chapter. Content measurement alone must not
      // move the document or interfere with anchor/navigation restoration.
      const layoutChanged =
        oldDistance !== distance ||
        sizes.some(
          (size, index) =>
            size.start !== oldSizes[index]?.start ||
            size.end !== oldSizes[index]?.end,
        );
      const navigating =
        navigationMotion.current &&
        !navigationMotion.current.paused &&
        !navigationMotion.current.completed;
      if (
        responsiveChange &&
        layoutChanged &&
        position &&
        position.hash === location.hash &&
        !navigating
      ) {
        const progress = (position.index + position.local) / sizes.length;
        window.scrollTo({
          top: containerTop + chapterScrollPosition(progress, sizes, distance),
          behavior: "instant",
        });
      }
      if (layoutChanged) pendingPreferencePosition = null;
      updateFromScroll();
    };
    const viewportResize = () => resize(true);
    const contentResize = new ResizeObserver(() => resize());
    contentResize.observe(container);
    document.fonts.ready.then(() => {
      if (!disposed) resize();
    });
    const changePreference = () => {
      pausedRef.current = preference.matches;
      setReduced(preference.matches);
      setPaused(preference.matches);
      earth.current?.setReducedMotion(preference.matches);
      earth.current?.setPaused(preference.matches);
      navigationMotion.current?.pause();
      if (preference.matches) {
        finishIntro();
        turn.settle?.pause();
        turn.pointer = null;
        turn.yaw = 0;
        applyTurn();
        delete container.dataset.globeTurn;
      }
      resize(true);
    };
    window.addEventListener("resize", viewportResize, { passive: true });
    preference.addEventListener("change", changePreference);
    return () => {
      disposed = true;
      window.clearTimeout(fallback);
      window.clearTimeout(fontDeadline);
      refreshScene.current = () => {};
      seekScroll.current = () => {};
      contentResize.disconnect();
      entrance?.revert();
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", onScroll);
      earth.current?.destroy();
      earth.current = null;
      window.removeEventListener("scroll", skipOnScroll);
      window.removeEventListener("resize", viewportResize);
      preference.removeEventListener("change", changePreference);
      turn.settle?.pause();
      container.removeEventListener("pointerdown", startTurn);
      container.removeEventListener("pointermove", moveTurn);
      container.removeEventListener("pointerup", endTurn);
      container.removeEventListener("pointercancel", endTurn);
      delete container.dataset.globeTurn;
    };
  }, [
    stylePreset,
    profile,
    siteConfig,
    bounds,
    figures,
    toolsIndex,
    continentalDrift,
    researchProjects.length,
  ]);

  useEffect(() => {
    pausedRef.current = paused;
    earth.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    const interrupt = () => {
      navigationMotion.current?.pause();
    };
    const key = (event: KeyboardEvent) => {
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
          "Escape",
        ].includes(event.key)
      )
        interrupt();
    };
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("pointerdown", interrupt, { passive: true });
    window.addEventListener("keydown", key);
    return () => {
      interrupt();
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("pointerdown", interrupt);
      window.removeEventListener("keydown", key);
    };
  }, []);

  function learnMore(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !siteConfig.hero.learnHref.startsWith("#")
    )
      return;
    const target = document.getElementById(siteConfig.hero.learnHref.slice(1));
    if (!target) return;
    event.preventDefault();
    if (location.hash !== siteConfig.hero.learnHref)
      history.pushState(null, "", siteConfig.hero.learnHref);
    const to = target.getBoundingClientRect().top + window.scrollY;
    navigationMotion.current?.pause();
    if (matchMedia(sceneLayout.reducedQuery).matches) {
      window.scrollTo({ top: to, behavior: "instant" });
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      return;
    }
    const position = { y: window.scrollY };
    navigationMotion.current = animate(position, {
      y: to,
      duration: 2500,
      ease: "inOut(2)",
      onUpdate: () => window.scrollTo({ top: position.y, behavior: "instant" }),
      onComplete: () => {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      },
    });
  }

  function seekPosition(position: number) {
    seekScroll.current(position);
  }

  return {
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
  };
}
