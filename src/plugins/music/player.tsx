"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { PluginProps } from "@/core/contracts";
import {
  registerFloatingSurface,
  claimFloatingPanel,
  refreshFloatingLayout,
} from "@/core/floating-surfaces";
import { createMusicController, type MusicController } from "./controller";
import { bindMediaSession } from "./media-session";
import type { MusicOptions } from "./types";
import { optionDefaults, themeAccents } from "./options.generated";
import { MusicIcon } from "./icons";
import styles from "./player.module.css";

const messages = {
  en: {
    label: "Music player",
    expand: "Expand player",
    collapse: "Collapse player",
    play: "Play",
    pause: "Pause",
    previous: "Previous track",
    next: "Next track",
    queue: "Playlist",
    volume: "Volume",
    repeat: "Repeat track",
    notes: "Colored notes",
    progress: "Playback progress",
    buffering: "Buffering — press to pause",
    playback: "Playback could not start. Press play to retry.",
    unavailable:
      "This track is unavailable. Try another track or press play to retry.",
    seek: "This audio cannot seek yet. Try again shortly.",
  },
  zh: {
    label: "音乐播放器",
    expand: "展开播放器",
    collapse: "收起播放器",
    play: "播放",
    pause: "暂停",
    previous: "上一首",
    next: "下一首",
    queue: "播放列表",
    volume: "音量",
    repeat: "单曲循环",
    notes: "彩色音符",
    progress: "播放进度",
    buffering: "正在缓冲，点击暂停",
    playback: "无法开始播放，请点击播放重试。",
    unavailable: "这首音乐暂时无法播放，请重试或切换歌曲。",
    seek: "当前音频暂时无法跳转，请稍后重试。",
  },
};
type Text = typeof messages.en;
type Panel = "queue" | "volume" | null;
const emptySubscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
function subscribeMotion(listener: () => void) {
  const query = matchMedia("(prefers-reduced-motion: reduce)");
  document.addEventListener("visibilitychange", listener);
  query.addEventListener("change", listener);
  return () => {
    document.removeEventListener("visibilitychange", listener);
    query.removeEventListener("change", listener);
  };
}
const motionAllowed = () =>
  !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches;
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const css = (variables: Record<string, string | number>) =>
  variables as CSSProperties;

function Progress({
  controller,
  text,
  active,
}: {
  controller: MusicController;
  text: Text;
  active: boolean;
}) {
  const progress = useSyncExternalStore(
    active ? controller.subscribeProgress : emptySubscribe,
    controller.getProgress,
    controller.getServerProgress,
  );
  return (
    <div className={styles.timeline}>
      <span className={styles.elapsed}>{time(progress.elapsed)}</span>
      <input
        type="range"
        className={styles.slider}
        aria-label={text.progress}
        aria-valuetext={`${time(progress.elapsed)} / ${progress.duration ? time(progress.duration) : "—:—"}`}
        min={0}
        max={progress.duration || 1}
        step={0.1}
        value={progress.elapsed}
        disabled={!progress.duration}
        style={css({
          "--progress": `${progress.duration ? (progress.elapsed / progress.duration) * 100 : 0}%`,
        })}
        onChange={(event) => controller.seek(Number(event.target.value))}
      />
      <span>{progress.duration ? time(progress.duration) : "—:—"}</span>
    </div>
  );
}
function Cover({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <span className={styles["record-fallback"]}>
        <MusicIcon name="note" />
      </span>
      {src && !failed && (
        <img
          className={styles["record-cover"]}
          src={src}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}

function Player({ options, context }: PluginProps<MusicOptions>) {
  const text = /^zh(?:-|$)/i.test(context.locale) ? messages.zh : messages.en;
  const [controller] = useState(() =>
    createMusicController(options.tracks, options.volume),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  const [expanded, setExpanded] = useState(
    options.initialExpanded ?? optionDefaults.initialExpanded,
  );
  const [panel, setPanel] = useState<Panel>(null);
  const [notes, setNotes] = useState(
    options.notes?.enabled ?? optionDefaults.notes.enabled,
  );
  const allowed = useSyncExternalStore(
    subscribeMotion,
    motionAllowed,
    serverReady,
  );
  const root = useRef<HTMLElement>(null),
    audio = useRef<HTMLAudioElement>(null),
    disclosure = useRef<HTMLButtonElement>(null),
    reveal = useRef<HTMLButtonElement>(null),
    panelRef = useRef<HTMLDivElement>(null);
  const focusDisclosure = useRef(false);
  const centered = (options.position ?? optionDefaults.position) === "bottom";
  const retracted = centered && !expanded;
  const queueButton = useRef<HTMLButtonElement>(null),
    volumeButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    const element = retracted ? reveal.current : root.current;
    if (element) return registerFloatingSurface(element, 10);
  }, [retracted]);
  useLayoutEffect(refreshFloatingLayout, [options.position]);
  useLayoutEffect(() => {
    if (!focusDisclosure.current) return;
    focusDisclosure.current = false;
    (retracted ? reveal : disclosure).current?.focus({ preventScroll: true });
  }, [expanded, retracted]);
  const changeExpanded = (value: boolean) => {
    focusDisclosure.current = value !== expanded;
    setExpanded(value);
    setPanel(null);
  };
  useEffect(() => {
    if (audio.current) return controller.attach(audio.current);
  }, [controller]);
  useEffect(
    () => controller.setTracks(options.tracks),
    [controller, options.tracks],
  );
  useEffect(() => bindMediaSession(controller), [controller]);
  const autoplay = options.autoplay ?? optionDefaults.autoplay;
  useEffect(() => {
    if (!autoplay) return;
    // The page loads first, so the track never competes with what it shows.
    let stop = () => {};
    const begin = () => {
      stop = controller.autostart(
        document,
        (event) =>
          event.target instanceof Node &&
          !!root.current?.contains(event.target),
      );
    };
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
    return () => {
      window.removeEventListener("load", begin);
      stop();
    };
  }, [controller, autoplay]);
  useEffect(() => {
    const onPageHide = () => controller.pause();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [controller]);
  useLayoutEffect(() => {
    if (!panel || !root.current || !panelRef.current) return;
    const element = root.current,
      popup = panelRef.current;
    const releasePanel = claimFloatingPanel(element, () => setPanel(null));
    const position = () => {
      const bounds = element.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0,
        bottom = top + (viewport?.height ?? innerHeight);
      const above = bounds.top - top - 18,
        below = bottom - bounds.bottom - 18;
      if (Math.max(above, below) < 180) {
        element.dataset.panelSide = "viewport";
        element.style.setProperty("--panel-top", `${top + 8 - bounds.top}px`);
        element.style.setProperty(
          "--panel-height",
          `${Math.min(280, bottom - top - 16)}px`,
        );
        return;
      }
      const useBelow = above < 180 && below > above;
      element.dataset.panelSide = useBelow ? "below" : "above";
      element.style.setProperty(
        "--panel-height",
        `${Math.max(80, Math.min(280, useBelow ? below : above))}px`,
      );
    };
    position();
    popup
      .querySelector<HTMLElement>(
        panel === "volume" ? "input" : '[aria-current="true"]',
      )
      ?.focus({ preventScroll: true });
    const outside = (event: Event) => {
      if (!(event.target instanceof Node)) return;
      if (!element.contains(event.target)) setPanel(null);
    };
    const focus = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !popup.contains(event.target) &&
        event.target !== queueButton.current &&
        event.target !== volumeButton.current
      )
        setPanel(null);
    };
    window.addEventListener("resize", position);
    element.addEventListener("floatinglayout", position);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focus);
    return () => {
      releasePanel();
      element.removeEventListener("floatinglayout", position);
      window.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focus);
    };
  }, [panel]);

  const colors = options.notes?.colors ?? optionDefaults.notes.colors;
  const accent =
    options.accent ?? themeAccents[options.theme ?? optionDefaults.theme];
  const motion = allowed && state.status === "playing";
  const iconButton = (name: "previous" | "next", delta: number) => (
    <button
      type="button"
      className={`${styles.icon} ${styles.skip}`}
      aria-label={text[name]}
      title={text[name]}
      disabled={state.count < 2}
      onClick={() => controller.select(state.index + delta)}
    >
      <MusicIcon name={name} />
    </button>
  );
  return (
    <aside
      ref={root}
      className={styles.music}
      data-plugin="music"
      aria-label={options.label ?? text.label}
      data-skin={options.skin ?? optionDefaults.skin}
      data-position={centered ? "center" : "right"}
      data-finish={options.theme ?? optionDefaults.theme}
      data-expanded={expanded}
      data-playing={state.status === "playing"}
      data-buffering={state.status === "loading"}
      data-motion={motion}
      data-hidden={!allowed}
      data-notes={notes}
      data-panel={panel || undefined}
      style={css({
        ...(options.offsetBottom === undefined
          ? {}
          : { "--music-bottom": `${options.offsetBottom}px` }),
        "--accent": accent,
        "--note-color-1": colors[0],
        "--note-color-2": colors[1],
        "--note-color-3": colors[2],
      })}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        if (panel) {
          (panel === "queue" ? queueButton : volumeButton).current?.focus();
          setPanel(null);
        } else {
          changeExpanded(false);
        }
      }}
    >
      {notes && (
        <>
          {centered && (
            <div className={styles["edge-glow"]} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          )}
          <div className={styles["music-notes"]} aria-hidden="true">
            {["note", "singleNote", "note", "singleNote"].map((name, index) => (
              <MusicIcon
                key={index}
                name={name as "note" | "singleNote"}
                className={styles["music-note"]}
              />
            ))}
          </div>
        </>
      )}
      {centered && (
        <button
          ref={reveal}
          type="button"
          className={styles["reveal-control"]}
          data-plugin="music-reveal"
          aria-label={text.expand}
          title={text.expand}
          aria-expanded={expanded}
          aria-controls={`${id}-shell`}
          aria-hidden={!retracted}
          tabIndex={retracted ? 0 : -1}
          onClick={() => changeExpanded(true)}
        >
          <MusicIcon name="chevronsUp" />
        </button>
      )}
      {panel && (
        <div
          ref={panelRef}
          id={`${id}-${panel}`}
          className={styles.popout}
          role="region"
          aria-label={text[panel]}
        >
          <div className={styles["popout-heading"]}>
            <span>
              {text[panel]}
              {panel === "queue" ? ` · ${state.count}` : ""}
            </span>
            {panel === "queue" && (
              <button
                type="button"
                className={styles.icon}
                aria-label={text.repeat}
                title={text.repeat}
                aria-pressed={state.repeat}
                onClick={controller.toggleRepeat}
              >
                <MusicIcon name="repeat" />
              </button>
            )}
          </div>
          {panel === "queue" ? (
            <>
              <ol className={styles.queue}>
                {options.tracks.map((track, index) => (
                  <li key={track.id}>
                    <button
                      type="button"
                      aria-current={track.id === state.track?.id}
                      onClick={() => {
                        controller.select(index, true);
                        setPanel(null);
                        queueButton.current?.focus();
                      }}
                    >
                      <span className={styles.number}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className={styles["track-label"]}>
                        {track.title}
                        {track.artist && <small>{track.artist}</small>}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className={styles["panel-settings"]}>
                <label className={styles["notes-option"]}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={notes}
                    onChange={(event) => setNotes(event.target.checked)}
                  />
                  {text.notes}
                </label>
              </div>
            </>
          ) : (
            <div className={styles["volume-row"]}>
              <MusicIcon name={state.volume ? "volume" : "muted"} />
              <input
                type="range"
                aria-label={text.volume}
                className={styles.slider}
                min={0}
                max={1}
                step={0.01}
                value={state.volume}
                onChange={(event) =>
                  controller.setVolume(Number(event.target.value))
                }
                style={css({ "--progress": `${state.volume * 100}%` })}
              />
              <output>{Math.round(state.volume * 100)}%</output>
            </div>
          )}
        </div>
      )}
      <div className={styles["shell-frame"]}>
        <div className={styles.shell} id={`${id}-shell`} inert={retracted}>
          <button
            ref={disclosure}
            type="button"
            className={styles["record-control"]}
            aria-label={expanded ? text.collapse : text.expand}
            title={expanded ? text.collapse : text.expand}
            aria-expanded={expanded}
            aria-controls={`${id}-metadata ${id}-transport`}
            onClick={() => changeExpanded(!expanded)}
          >
            <span className={styles.record} aria-hidden="true">
              <Cover key={state.track?.cover} src={state.track?.cover} />
            </span>
            <span className={styles["square-art"]} aria-hidden="true">
              <Cover key={state.track?.cover} src={state.track?.cover} />
            </span>
            <span className={styles["record-glint"]} aria-hidden="true" />
          </button>
          <div
            className={styles.metadata}
            id={`${id}-metadata`}
            inert={!expanded}
          >
            <div className={styles["song-title"]} title={state.track?.title}>
              {state.track?.title}
            </div>
            <div className={styles.artist} title={state.track?.artist}>
              {state.track?.artist || "\u00a0"}
            </div>
          </div>
          <div
            className={styles.transport}
            id={`${id}-transport`}
            inert={!expanded}
          >
            {iconButton("previous", -1)}
            <button
              type="button"
              className={`${styles.icon} ${styles.play}`}
              aria-label={state.intent ? text.pause : text.play}
              title={
                state.status === "loading"
                  ? text.buffering
                  : state.intent
                    ? text.pause
                    : text.play
              }
              aria-pressed={state.intent}
              onClick={() =>
                state.intent ? controller.pause() : void controller.play()
              }
            >
              <MusicIcon name={state.intent ? "pause" : "play"} />
            </button>
            {iconButton("next", 1)}
            <Progress controller={controller} text={text} active={expanded} />
            <button
              ref={volumeButton}
              type="button"
              className={styles.icon}
              aria-label={text.volume}
              title={text.volume}
              aria-expanded={panel === "volume"}
              aria-controls={panel === "volume" ? `${id}-volume` : undefined}
              onClick={() => setPanel(panel === "volume" ? null : "volume")}
            >
              <MusicIcon name={state.volume ? "volume" : "muted"} />
            </button>
            <button
              ref={queueButton}
              type="button"
              className={styles.icon}
              aria-label={text.queue}
              title={text.queue}
              aria-expanded={panel === "queue"}
              aria-controls={panel === "queue" ? `${id}-queue` : undefined}
              onClick={() => setPanel(panel === "queue" ? null : "queue")}
            >
              <MusicIcon name="list" />
            </button>
          </div>
        </div>
      </div>
      {state.error && !panel && (
        <p role="status" className={styles["player-message"]}>
          {text[state.error]}
        </p>
      )}
      <audio ref={audio} preload="none" hidden />
    </aside>
  );
}

export default function MusicPlayer(props: PluginProps<MusicOptions>) {
  const ready = useSyncExternalStore(emptySubscribe, clientReady, serverReady);
  // A body portal avoids fixed-position containment and clipping by template transforms.
  return ready && props.options.tracks.length
    ? createPortal(<Player {...props} />, document.body)
    : null;
}
