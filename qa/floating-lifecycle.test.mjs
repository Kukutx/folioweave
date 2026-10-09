import assert from "node:assert/strict";
import test from "node:test";
import {
  registerFloatingSurface,
  refreshFloatingLayout,
  claimFloatingPanel,
} from "../src/core/floating-surfaces.ts";

test("floating registry coalesces work, restores anchors and releases its last observer/listeners", () => {
  const originals = new Map();
  const install = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  };
  class TrackedTarget extends EventTarget {
    listeners = new Set();
    addEventListener(name, fn) {
      super.addEventListener(name, fn);
      this.listeners.add(`${name}:${fn.name}`);
    }
    removeEventListener(name, fn) {
      super.removeEventListener(name, fn);
      this.listeners.delete(`${name}:${fn.name}`);
    }
  }
  class Surface extends EventTarget {
    dataset = { plugin: "fixture" };
    values = new Map();
    style = {
      setProperty: (key, value) => this.values.set(key, value),
      removeProperty: (key) => this.values.delete(key),
    };
    getBoundingClientRect() {
      return {
        x: 240 + parseFloat(this.values.get("--fw-float-x") || "0"),
        y: 300 + parseFloat(this.values.get("--fw-float-y") || "0"),
        width: 80,
        height: 80,
      };
    }
  }
  const win = new TrackedTarget();
  win.visualViewport = Object.assign(new TrackedTarget(), {
    width: 390,
    height: 844,
    offsetLeft: 0,
    offsetTop: 0,
  });
  let observed = 0,
    disconnected = 0,
    sequence = 0;
  const frames = new Map();
  const flush = () => {
    const work = [...frames.values()];
    frames.clear();
    work.forEach((fn) => fn());
  };
  install("window", win);
  install(
    "ResizeObserver",
    class {
      observe() {
        observed++;
      }
      unobserve() {
        observed--;
      }
      disconnect() {
        disconnected++;
      }
    },
  );
  install("requestAnimationFrame", (fn) => {
    const id = ++sequence;
    frames.set(id, fn);
    return id;
  });
  install("cancelAnimationFrame", (id) => frames.delete(id));
  const a = new Surface(),
    b = new Surface();
  let removeA, removeB;
  try {
    const native = new Surface();
    delete native.dataset.plugin;
    assert.throws(() => registerFloatingSurface(native), /plugin-owned/);
    assert.equal(frames.size, 0);
    assert.equal(observed, 0);
    assert.equal(native.values.size, 0);
    removeA = registerFloatingSurface(a, 10);
    removeB = registerFloatingSurface(b, 0);
    for (let i = 0; i < 50; i++) refreshFloatingLayout();
    assert.equal(frames.size, 1);
    flush();
    assert.equal(frames.size, 0, "no permanent RAF loop");
    assert.equal(observed, 2);
    assert.equal(a.values.size, 0, "priority surface keeps its anchor");
    assert.ok(b.values.size > 0, "second surface moves aside");
    removeA();
    flush();
    assert.equal(b.values.get("--fw-float-x"), "0px");
    assert.equal(b.values.get("--fw-float-y"), "0px");
    removeB();
    removeB();
    assert.equal(observed, 0);
    assert.equal(disconnected, 1);
    assert.equal(frames.size, 0);
    assert.equal(win.listeners.size, 0);
    assert.equal(win.visualViewport.listeners.size, 0);
    assert.equal(b.values.size, 0);
    assert.equal(b.dataset.floatingCrowded, undefined);
    const strictRemount = registerFloatingSurface(a);
    strictRemount();
    assert.equal(disconnected, 2);
  } finally {
    removeA?.();
    removeB?.();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("late panel cleanup cannot release a newer plugin's panel", () => {
  const a = {},
    b = {},
    c = {};
  let aClosed = 0,
    bClosed = 0;
  const releaseA = claimFloatingPanel(a, () => aClosed++);
  const releaseB = claimFloatingPanel(b, () => bClosed++);
  assert.equal(aClosed, 1);
  releaseA();
  const releaseC = claimFloatingPanel(c, () => {});
  assert.equal(bClosed, 1);
  releaseB();
  releaseC();
});
