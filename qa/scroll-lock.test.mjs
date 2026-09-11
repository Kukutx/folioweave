import assert from "node:assert/strict";
import test from "node:test";
import { lockPageScroll } from "../src/lib/scroll-lock.ts";

test("scroll locks compose, restore ownership, and preserve subsequent navigation", () => {
  const names = ["window", "document"];
  const originals = names.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]);
  let starts = 0;
  const root = {
    clientWidth: 1425,
    style: { scrollbarGutter: "", overflowAnchor: "auto" },
    getBoundingClientRect: () => ({}),
  };
  const body = { style: { overflow: "clip", overflowAnchor: "auto" } };
  const lenis = {
    isStopped: false,
    stop() {
      this.isStopped = true;
    },
    start() {
      starts++;
      this.isStopped = false;
    },
  };
  const viewport = {
    innerWidth: 1440,
    scrollX: 0,
    scrollY: 6400,
    __lenis: lenis,
    scrollTo({ left, top }) {
      this.scrollX = left;
      this.scrollY = top;
    },
  };
  try {
    Object.assign(globalThis, {
      window: viewport,
      document: { documentElement: root, body },
    });
    const first = lockPageScroll();
    const second = lockPageScroll();
    assert.equal(root.style.scrollbarGutter, "stable");
    viewport.scrollY = 6500;
    first();
    first(); // An owner's duplicate cleanup must not release another lock.
    assert.equal(body.style.overflow, "hidden");
    assert.equal(lenis.isStopped, true);
    second();
    assert.equal(viewport.scrollY, 6400, "position restores synchronously");
    assert.equal(body.style.overflow, "clip");
    assert.equal(starts, 1);

    const third = lockPageScroll();
    assert.equal(body.style.overflowAnchor, "auto", "the lock does not mutate the shell anchoring policy");
    third();
    viewport.scrollY = 7000; // A subsequent navigation must not be overwritten.
    assert.equal(viewport.scrollY, 7000);
    assert.deepEqual(root.style, {
      scrollbarGutter: "",
      overflowAnchor: "auto",
    });
    assert.deepEqual(body.style, { overflow: "clip", overflowAnchor: "auto" });

    lenis.isStopped = true;
    viewport.innerWidth = root.clientWidth;
    const overlay = lockPageScroll();
    assert.equal(
      root.style.scrollbarGutter,
      "",
      "overlay scrollbars need no added gutter",
    );
    overlay();
    assert.equal(
      lenis.isStopped,
      true,
      "an externally stopped scroller stays stopped",
    );
    assert.equal(starts, 2);
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
