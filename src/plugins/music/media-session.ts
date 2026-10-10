import type { MusicController } from "./controller";

/** Hand the transport to the system as well: a keyboard's media keys, a
 * headset's buttons and a phone's lock screen show the track with its cover and
 * drive this player. Returns the way to take it back. */
export function bindMediaSession(controller: MusicController) {
  const session =
    typeof navigator === "undefined" ? undefined : navigator.mediaSession;
  if (!session || typeof MediaMetadata === "undefined") return () => {};
  const handle = (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null,
  ) => {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // An engine that does not know an action keeps its own default for it.
    }
  };
  let shown: unknown, several: boolean | undefined;
  const sync = () => {
    const { track, intent, count } = controller.getSnapshot();
    if (track !== shown) {
      shown = track;
      session.metadata = track
        ? new MediaMetadata({
            title: track.title,
            artist: track.artist ?? "",
            artwork: track.cover ? [{ src: track.cover }] : [],
          })
        : null;
    }
    session.playbackState = track ? (intent ? "playing" : "paused") : "none";
    if (several === count > 1) return;
    several = count > 1;
    const step = (delta: number) =>
      several
        ? () => controller.select(controller.getSnapshot().index + delta)
        : null;
    handle("previoustrack", step(-1));
    handle("nexttrack", step(1));
  };
  handle("play", () => void controller.play());
  handle("pause", () => controller.pause());
  sync();
  const unsubscribe = controller.subscribe(sync);
  return () => {
    unsubscribe();
    for (const action of [
      "play",
      "pause",
      "previoustrack",
      "nexttrack",
    ] as const)
      handle(action, null);
    session.metadata = null;
    session.playbackState = "none";
  };
}
