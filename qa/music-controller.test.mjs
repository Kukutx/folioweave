import assert from "node:assert/strict";
import test from "node:test";
import { createMusicController } from "../src/plugins/music/controller.ts";

const tracks = [
  { id: "one", title: "One", src: "/portfolio/one.wav" },
  { id: "two", title: "Two", src: "/portfolio/two.wav" },
];
class AudioFixture extends EventTarget {
  paused = true;
  volume = 0.7;
  muted = false;
  loop = false;
  currentTime = 0;
  duration = 30;
  error = null;
  attributes = new Map();
  pending = [];
  attached = new Set();
  loads = 0;
  addEventListener(name, listener) {
    super.addEventListener(name, listener);
    this.attached.add(listener);
  }
  removeEventListener(name, listener) {
    super.removeEventListener(name, listener);
    this.attached.delete(listener);
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  load() {
    this.loads++;
    this.currentTime = 0;
  }
  play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    return new Promise((resolve, reject) =>
      this.pending.push({ resolve, reject }),
    );
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  playing() {
    this.dispatchEvent(new Event("playing"));
    this.pending.at(-1)?.resolve();
  }
}

test("cancelled and superseded playback failures cannot replace current state", async () => {
  const player = createMusicController(tracks),
    audio = new AudioFixture();
  const detach = player.attach(audio);
  const first = player.play();
  assert.equal(player.getSnapshot().intent, true);
  player.pause();
  audio.pending[0].reject(new Error("late error"));
  await first;
  assert.equal(player.getSnapshot().error, "");
  player.select(1, true);
  audio.playing();
  assert.equal(player.getSnapshot().track.id, "two");
  assert.equal(player.getSnapshot().status, "playing");
  detach();
  assert.equal(audio.attached.size, 0);
  assert.equal(audio.getAttribute("src"), null);
  assert.equal(audio.paused, true);
});

test("time updates notify only the progress subscriber", () => {
  const player = createMusicController(tracks),
    audio = new AudioFixture();
  const detach = player.attach(audio);
  let transport = 0,
    progress = 0;
  player.subscribe(() => transport++);
  player.subscribeProgress(() => progress++);
  for (let i = 1; i <= 20; i++) {
    audio.currentTime = i;
    audio.dispatchEvent(new Event("timeupdate"));
  }
  assert.equal(transport, 0);
  assert.equal(progress, 20);
  assert.equal(player.getProgress().elapsed, 20);
  audio.duration = Infinity;
  audio.dispatchEvent(new Event("durationchange"));
  assert.equal(player.getProgress().duration, 0);
  detach();
});

test("reordering tracks preserves playback identity; removing it releases the source", async () => {
  const player = createMusicController(tracks),
    audio = new AudioFixture();
  const detach = player.attach(audio);
  const playing = player.play();
  audio.playing();
  await playing;
  player.setTracks([...tracks].reverse());
  assert.equal(player.getSnapshot().index, 1);
  assert.equal(audio.paused, false);
  assert.equal(audio.loads, 0);
  player.setTracks([]);
  assert.equal(audio.getAttribute("src"), null);
  assert.equal(player.getSnapshot().track, null);
  assert.equal(audio.paused, true);
  detach();
});

test("single-track playback stops at end, while repeat restarts the same track", async () => {
  const player = createMusicController([tracks[0]]),
    audio = new AudioFixture();
  const detach = player.attach(audio);
  let pending = player.play();
  audio.playing();
  await pending;
  audio.dispatchEvent(new Event("ended"));
  assert.equal(player.getSnapshot().intent, false);
  player.toggleRepeat();
  assert.equal(audio.loop, true);
  pending = player.play();
  audio.playing();
  await pending;
  audio.dispatchEvent(new Event("ended"));
  assert.equal(player.getSnapshot().track.id, "one");
  assert.equal(player.getSnapshot().intent, true);
  audio.playing();
  detach();
});

test("unmount invalidates delayed promises and repeated attachment does not leak listeners", async () => {
  const player = createMusicController(tracks),
    audio = new AudioFixture();
  const detach = player.attach(audio);
  const count = audio.attached.size;
  const pending = player.play();
  detach();
  audio.pending[0].reject(new Error("after unmount"));
  await pending;
  assert.equal(player.getSnapshot().error, "");
  const again = player.attach(audio);
  assert.equal(audio.attached.size, count);
  assert.equal(audio.getAttribute("src"), tracks[0].src);
  assert.equal(player.getSnapshot().intent, false);
  again();
  assert.equal(audio.attached.size, 0);
});

test("advancing time ends a stall even when the engine never reports playing again", () => {
  const player = createMusicController(tracks),
    audio = new AudioFixture();
  const detach = player.attach(audio);
  void player.play();
  audio.playing();
  assert.equal(player.getSnapshot().status, "playing");
  audio.dispatchEvent(new Event("waiting"));
  assert.equal(player.getSnapshot().status, "loading");
  audio.currentTime = 0;
  audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(
    player.getSnapshot().status,
    "loading",
    "No time has passed yet",
  );
  audio.currentTime = 1.5;
  audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(player.getSnapshot().status, "playing");
  player.pause();
  audio.currentTime = 2;
  audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(
    player.getSnapshot().status,
    "paused",
    "A paused track was reported as playing",
  );
  detach();
});
