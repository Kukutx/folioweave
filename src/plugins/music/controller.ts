import type { Track } from "./types";
import { optionDefaults } from "./options.generated.ts";

type Snapshot = {
  track: Track | null;
  index: number;
  count: number;
  status: "idle" | "loading" | "playing" | "paused" | "error";
  intent: boolean;
  repeat: boolean;
  volume: number;
  error: "" | "playback" | "unavailable" | "seek";
};
type Progress = { elapsed: number; duration: number };
type Listener = () => void;
/** The presses a browser accepts as the visitor's consent to sound. */
const gestures = ["pointerdown", "pointerup", "keydown", "touchend"] as const;
/** Heard before the page's own handlers can stop the event. */
const early = { capture: true };

/** Owns one audio element. Progress has a separate subscription from transport. */
export function createMusicController(
  initialTracks: Track[],
  initialVolume = optionDefaults.volume,
) {
  let tracks = initialTracks;
  let audio: HTMLAudioElement | null = null;
  let request = 0;
  let removeEvents = () => {};
  let snapshot: Snapshot = {
    track: tracks[0] ?? null,
    index: 0,
    count: tracks.length,
    status: "idle",
    intent: false,
    repeat: false,
    volume: initialVolume,
    error: "",
  };
  let progress: Progress = { elapsed: 0, duration: 0 };
  const serverSnapshot = snapshot,
    serverProgress = progress;
  const listeners = new Set<Listener>(),
    progressListeners = new Set<Listener>();
  const publish = (patch: Partial<Snapshot>) => {
    if (
      Object.entries(patch).every(
        ([key, value]) => snapshot[key as keyof Snapshot] === value,
      )
    )
      return;
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };
  const publishProgress = (elapsed: number, duration: number) => {
    duration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    elapsed = Number.isFinite(elapsed)
      ? Math.max(0, duration ? Math.min(elapsed, duration) : elapsed)
      : 0;
    if (progress.elapsed === elapsed && progress.duration === duration) return;
    progress = { elapsed, duration };
    progressListeners.forEach((listener) => listener());
  };
  function pause() {
    request++;
    audio?.pause();
    publish({ status: "paused", intent: false });
  }
  /** Resolves to whether this request is the one that started playback. */
  async function play(unprompted = false) {
    if (!audio || !snapshot.track) return false;
    const element = audio,
      version = ++request;
    // An unprompted start may be refused outright, so it claims nothing until
    // the element itself reports that it is under way.
    if (!unprompted) publish({ status: "loading", intent: true, error: "" });
    try {
      if (element.error) element.load();
      await element.play();
      return version === request && element === audio;
    } catch (error) {
      if (version !== request || element !== audio) return false;
      const name = error instanceof Error ? error.name : "";
      if (unprompted && name === "NotAllowedError") return false;
      publish({
        status: "error",
        intent: false,
        error: name === "AbortError" ? "playback" : "unavailable",
      });
      return false;
    }
  }
  /** Start on arrival. Where the browser withholds sound until the visitor has
   * touched the page, their first press outside the player starts it instead; a
   * press on the player is the visitor taking over. Returns the way to call it
   * off. */
  function autostart(page: EventTarget, own: (event: Event) => boolean) {
    let waiting = true;
    const stop = () => {
      if (!waiting) return;
      waiting = false;
      for (const name of gestures) page.removeEventListener(name, press, early);
    };
    const attempt = () =>
      void play(true).then((started) => {
        if (started) stop();
      });
    function press(event: Event) {
      if (own(event)) stop();
      else attempt();
    }
    for (const name of gestures) page.addEventListener(name, press, early);
    attempt();
    return stop;
  }
  function loadTrack(track: Track | null) {
    request++;
    audio?.pause();
    publishProgress(0, 0);
    if (!audio) return;
    if (track) audio.setAttribute("src", track.src);
    else audio.removeAttribute("src");
    audio.load();
  }
  function select(next: number, resume = snapshot.intent) {
    if (!tracks.length) return;
    const index = ((next % tracks.length) + tracks.length) % tracks.length;
    const track = tracks[index];
    publish({ track, index, status: "paused", intent: false, error: "" });
    loadTrack(track);
    if (resume) void play();
  }
  function setTracks(next: Track[]) {
    if (next === tracks) return;
    const previous = snapshot.track;
    tracks = next;
    const index = Math.max(
      0,
      next.findIndex((track) => track.id === previous?.id),
    );
    const track = next[index] ?? null;
    const sameSource =
      track?.id === previous?.id && track?.src === previous?.src;
    publish({ track, index, count: next.length });
    if (!sameSource) {
      pause();
      loadTrack(track);
      publish({ error: "" });
    }
  }
  function detach() {
    request++;
    removeEvents();
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio = null;
    }
    publish({ status: "paused", intent: false });
  }
  function attach(element: HTMLAudioElement) {
    if (audio) detach();
    audio = element;
    const entries: [string, EventListener][] = [];
    const on = (event: string, listener: () => void) => {
      entries.push([event, listener]);
      element.addEventListener(event, listener);
    };
    const updateProgress = () => {
      publishProgress(element.currentTime, element.duration);
      // Engines differ on whether "playing" follows every stall. Advancing
      // time is the fact; never leave the control saying it is still loading.
      if (
        snapshot.status === "loading" &&
        snapshot.intent &&
        !element.paused &&
        element.currentTime > 0
      )
        publish({ status: "playing", error: "" });
    };
    on("play", () => {
      if (element.paused) return;
      publish(
        snapshot.status === "playing"
          ? { intent: true }
          : { status: "loading", intent: true, error: "" },
      );
    });
    on("playing", () => {
      if (!element.paused)
        publish({ status: "playing", intent: true, error: "" });
    });
    on("pause", () => {
      if (element.paused) publish({ status: "paused", intent: false });
    });
    on("waiting", () => {
      if (snapshot.intent) publish({ status: "loading" });
    });
    on("timeupdate", updateProgress);
    on("durationchange", updateProgress);
    on("loadedmetadata", updateProgress);
    on("ended", () => {
      if (snapshot.repeat) select(snapshot.index, true);
      else if (tracks.length > 1) select(snapshot.index + 1, true);
      else pause();
    });
    on("error", () => {
      request++;
      publish({ status: "error", intent: false, error: "unavailable" });
    });
    on("volumechange", () =>
      publish({ volume: element.muted ? 0 : element.volume }),
    );
    element.volume = snapshot.volume;
    element.loop = snapshot.repeat;
    if (snapshot.track && element.getAttribute("src") !== snapshot.track.src)
      element.setAttribute("src", snapshot.track.src);
    removeEvents = () =>
      entries.forEach(([name, listener]) =>
        element.removeEventListener(name, listener),
      );
    return detach;
  }
  return {
    attach,
    setTracks,
    play,
    autostart,
    pause,
    select,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    getProgress: () => progress,
    getServerProgress: () => serverProgress,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeProgress(listener: Listener) {
      progressListeners.add(listener);
      return () => {
        progressListeners.delete(listener);
      };
    },
    toggleRepeat() {
      const repeat = !snapshot.repeat;
      if (audio) audio.loop = repeat;
      publish({ repeat });
    },
    setVolume(volume: number) {
      if (!Number.isFinite(volume)) return;
      volume = Math.max(0, Math.min(1, volume));
      if (audio) {
        audio.muted = false;
        audio.volume = volume;
      }
      publish({ volume });
    },
    seek(time: number) {
      if (!audio || !Number.isFinite(time) || !progress.duration) return;
      try {
        audio.currentTime = Math.max(0, Math.min(progress.duration, time));
        publishProgress(audio.currentTime, progress.duration);
      } catch {
        publish({ error: "seek" });
      }
    },
  };
}
export type MusicController = ReturnType<typeof createMusicController>;
