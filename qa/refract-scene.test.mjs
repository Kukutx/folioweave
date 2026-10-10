import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { createHash } from "node:crypto";
import ts from "typescript";

const root = fileURLToPath(new URL("../src/components/refract/", import.meta.url));
const modules = new Map();
// Load the real TypeScript modules without a second implementation or test build.
async function moduleURL(path) {
  if (modules.has(path)) return modules.get(path);
  if (path.endsWith(".json")) {
    const url = `data:text/javascript;base64,${Buffer.from(`export default ${await readFile(path, "utf8")}`).toString("base64")}`;
    modules.set(path, url);
    return url;
  }
  let code = ts.transpileModule(await readFile(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replaceAll("import.meta.url", JSON.stringify(pathToFileURL(path).href));
  for (const match of code.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    code = code.replace(match[0], `from "${await moduleURL(resolve(dirname(path), match[1] + (match[1].endsWith(".json") ? "" : ".ts")))}"`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  modules.set(path, url);
  return url;
}
const load = async path => import(await moduleURL(resolve(root, path)));
const theme = await load("lib/scene-theme.ts");
const progress = await load("lib/scene-progress.ts");
const siteConfig = { effects: { continentalDrift: { enabled: true, amplitude: 1, spread: 1.18, duration: 8, repeatDelay: 3, leadIn: .012 } } };
const { createEarthRenderer } = await load("lib/earth-renderer.ts");
const { createResearchLayers } = await load("lib/research-layers.ts");
const { createGlassShell, spherePoint, axialRotation, rotate, rotation } = await load("lib/earth-geometry.ts");
const { createGlassShards, glassShardPose, transformShardPoint } = await load("lib/glass-fracture.ts");
const { createContinentalPlates, continentalRegion, continentalPose, transformContinentalPoint } = await load("lib/continental-drift.ts");
const { sceneCamera, scenePerspective, sceneSphereScale, fitBesideReading, SCENE_FOCAL_DISTANCE } = await load("lib/scene-camera.ts");

test("camera shots settle at the original reading composition and preserve depth parallax", () => {
  for (const mobile of [false, true]) {
    for (const p of [0, .42, .5, .6, .7, .81]) {
      assert.equal(sceneCamera(p, false, mobile).distance, SCENE_FOCAL_DISTANCE);
    }
    const wide = sceneCamera(.85, false, mobile).distance;
    const close = sceneCamera(.375, false, mobile).distance;
    assert.ok(close < SCENE_FOCAL_DISTANCE && wide === SCENE_FOCAL_DISTANCE);
    const nearGrowth = scenePerspective(1, close) / scenePerspective(1, wide);
    const farGrowth = scenePerspective(-1, close) / scenePerspective(-1, wide);
    assert.ok(nearGrowth > farGrowth, "Camera travel was flattened to a 2D scale");
    assert.ok(sceneSphereScale(close) > 1);
    let previous;
    for (let i = 0; i <= 10000; i++) {
      const p = i / 10000, pose = sceneCamera(p, false, mobile);
      assert.ok(pose.distance > 4.5, "The lens entered the assembly");
      for (const [key, value] of Object.entries(pose)) {
        assert.ok(Number.isFinite(value));
        if (previous) assert.ok(Math.abs(value - previous[key]) < .03, `${key} jumped at ${p}`);
      }
      const reduced = sceneCamera(p, true, mobile);
      assert.equal(reduced.distance, SCENE_FOCAL_DISTANCE);
      assert.equal(reduced.yaw + reduced.pitch + reduced.layerYaw + reduced.layerPitch, 0);
      previous = pose;
    }
  }
});

test("globe-to-layer transition never shrinks the globe below its established size", () => {
  for (const mobile of [false, true]) for (const p of [.08, .1, .12, .1473, .17, .2, .24, .27]) {
    assert.ok(SCENE_FOCAL_DISTANCE / sceneCamera(p, false, mobile).distance >= 1.01, `The bridge shot became small at ${p}`);
  }
  assert.equal(sceneCamera(.42).distance, SCENE_FOCAL_DISTANCE);
});

test("Research camera settles throughout reassembly instead of adding a late zoom pulse", () => {
  for (const mobile of [false, true]) {
    let previous = sceneCamera(.35, false, mobile).distance;
    for (let i = 351; i <= 420; i++) {
      const distance = sceneCamera(i / 1000, false, mobile).distance;
      assert.ok(distance >= previous, `Camera reversed while reassembling at ${i / 1000}`);
      assert.ok(distance <= SCENE_FOCAL_DISTANCE, "Return overshot into a smaller globe");
      previous = distance;
    }
  }
});

test("Research retains physical material through compression and hands off only near closure", () => {
  assert.deepEqual(progress.researchBlend(1), { lines: 1, globe: 0, surfaces: 1 });
  assert.deepEqual(progress.researchBlend(0), { lines: 0, globe: 1, surfaces: 0 });
  let previous;
  for (let i = 0; i <= 1000; i++) {
    const blend = progress.researchBlend(i / 1000);
    assert.ok(blend.lines * blend.surfaces + blend.globe >= .8, "Compression dissolved into a wire-only stage");
    if (i >= 350) {
      assert.equal(blend.surfaces, 1, "Separated sheets lost their solid material before folding");
      assert.equal(blend.globe, 0, "The globe appeared behind still-separated sheets");
    }
    if (previous) for (const key of ["lines", "globe", "surfaces"]) {
      assert.ok(Math.abs(blend[key] - previous[key]) < .01, `${key} jumps during the handoff`);
    }
    previous = blend;
  }
  for (const style of ["light", "dark"]) {
    assert.equal(theme.sceneLight(.35, style), 1, "Open Research drawing changed backdrop too early");
    assert.equal(theme.sceneLight(.395, style), 0, "A grey transitional backdrop lingered over the globe");
  }
});

test("Research renders solid folding faces, clears them at closure and reverses without stale geometry", () => {
  for (const style of ["dark", "light"]) for (const width of [1440, 390]) {
    const target = recordingCanvas(width);
    const renderer = createEarthRenderer(target.canvas, { autoStart: false, style });
    const solidFaces = () => {
      let alpha = 1, fill = "", count = 0;
      const saved = [];
      for (const [kind, value] of target.commands) {
        if (kind === "save") saved.push([alpha, fill]);
        else if (kind === "restore") [alpha, fill] = saved.pop();
        else if (kind === "globalAlpha") alpha = value;
        else if (kind === "fillStyle") fill = value;
        else if (kind === "fill" && typeof fill === "string" && fill.endsWith(",.94)") && alpha > .8) count++;
      }
      return count;
    };
    for (const p of [.35, .36, .375, .38]) {
      const forward = target.capture(renderer, p);
      assert.ok(solidFaces() > 100, `Folding material disappeared at ${p}, ${style}, ${width}px`);
      target.capture(renderer, .42);
      assert.equal(solidFaces(), 0, "Opaque tiles blanket the restored globe");
      assert.equal(target.capture(renderer, p), forward, "Reverse seek changed the fold");
    }
    renderer.destroy();
  }
});

test("Research ink and terrain do not flash when the folding backdrop crosses mid-grey", () => {
  const target = recordingCanvas(), layers = createResearchLayers();
  const colors = dark => {
    target.commands.length = 0;
    layers.draw(target.canvas.getContext("2d"), {
      amount: .5, clock: 3, mobile: false, dark, poseKey: .375,
      plane: p => p, globe: p => p, project: p => ({ ...p, perspective: 1 }),
    });
    return target.commands.filter(([kind, value]) => ["fillStyle", "strokeStyle"].includes(kind) && typeof value === "string")
      .map(([, value]) => value.match(/[\d.]+/g).map(Number));
  };
  const a = colors(.4999), b = colors(.5001);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) for (let c = 0; c < 3; c++) {
    assert.ok(Math.abs(a[i][c] - b[i][c]) <= 1, "Material jumped between light and dark drawing palettes");
  }
  layers.destroy();
});

test("Tools winds continuously into a centered front view before departure, without zooming", () => {
  for (const mobile of [false, true]) {
    let previous = sceneCamera(.89, false, mobile);
    for (let i = 820; i <= 948; i++) {
      const camera = sceneCamera(i / 1000, false, mobile);
      assert.equal(camera.distance, SCENE_FOCAL_DISTANCE, "Tools introduced another zoom beat");
      if (i > 890 && i < 938) {
        assert.ok(camera.yaw < previous.yaw, "The complete assembly stopped turning during closure");
        previous = camera;
      }
      if (i >= 938) {
        const normal = rotate({ x: 0, y: 0, z: 1 }, rotation(camera.yaw, camera.pitch, camera.roll));
        assert.ok(normal.z > .999999, "The ring never presented its full front before leaving");
        assert.equal(progress.toolsOpening(i / 1000), 0);
        assert.equal(progress.sceneExit(i / 1000), 0, "Departure cut short the centered front view");
      }
    }
    assert.ok(Math.abs(sceneCamera(.82).yaw - sceneCamera(progress.toolsMotion.orbitEnd).yaw - 2 * Math.PI) < 1e-12);
  }
  assert.equal(progress.toolsTurn(.89), 0);
  assert.equal(progress.toolsTurn(.938), 1);
  assert.ok(progress.toolsTurn(.91) > .2 && progress.toolsTurn(.91) < .5);
});

test("Tools closing has no sudden contraction between adjacent scroll positions", () => {
  for (const width of [1440, 1920]) {
    const target = recordingCanvas(width, 1080);
    const renderer = createEarthRenderer(target.canvas, { autoStart: false });
    let previous = 0;
    for (let step = 0; step <= 192; step++) {
      target.capture(renderer, .89 + step * .00025);
      let path = [], left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const [kind, ...args] of target.commands) {
        if (kind === "beginPath") path = [];
        else if (["moveTo", "lineTo", "closePath"].includes(kind)) path.push([kind, ...args]);
        else if (kind === "fill" && path.map(p => p[0]).join() === "moveTo,lineTo,lineTo,closePath") {
          for (const [, x, y] of path.slice(0, 3)) {
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
        }
      }
      const size = Math.hypot(right - left, bottom - top);
      assert.ok(Number.isFinite(size) && size > 100);
      if (previous) assert.ok(size / previous > .98, `Assembly abruptly contracted at ${.89 + step * .00025}, ${width}px`);
      previous = size;
    }
    renderer.destroy();
  }
});

test("Tools passes through intermediate guide poses without stopping or reversing", () => {
  const h = 1e-7;
  for (const p of [.85, .863, .89]) {
    const a = sceneCamera(p - h), b = sceneCamera(p), c = sceneCamera(p + h);
    for (const key of ["yaw", "pitch", "roll"]) {
      const incoming = (b[key] - a[key]) / h, outgoing = (c[key] - b[key]) / h;
      assert.ok(Math.abs(incoming - outgoing) < .01, `${key} changes speed abruptly at ${p}`);
    }
    assert.ok((c.yaw - a.yaw) / (2 * h) < -1, `The turn stalled at ${p}`);
  }
  let previous = sceneCamera(.82).yaw;
  for (let i = 8201; i <= 9380; i++) {
    const yaw = sceneCamera(i / 10000).yaw;
    assert.ok(yaw <= previous, "The guide interpolation reversed the orbit");
    previous = yaw;
  }
});

test("glass retains feathered surface reflections without the removed white hook or column", () => {
  for (const width of [390, 1440]) {
    const target = recordingCanvas(width);
    const renderer = createEarthRenderer(target.canvas, { autoStart: false });
    for (const p of [0, .395, .414, .5, .875, .91, .938, .95]) {
      target.capture(renderer, p);
      let ellipse = false, lineWidth = 1, fill;
      for (const [kind, value] of target.commands) {
        if (kind === "beginPath") ellipse = false;
        if (kind === "ellipse") ellipse = true;
        if (kind === "lineWidth") lineWidth = value;
        if (kind === "fillStyle") fill = value;
        if (kind === "stroke") assert.ok(!(ellipse && lineWidth >= 3), `White hook returned at ${p}`);
        if (kind === "fillRect" && fill?.args) {
          assert.equal(fill.args.length, 6, "A uniform linear highlight crossed the entire globe again");
          assert.equal(fill.stops.at(-1)[1], "rgba(255,255,255,0)", "Surface reflection lost its feathered boundary");
        }
      }
    }
    renderer.destroy();
  }
});

test("surface materials and chapter accents interpolate without a threshold flash", () => {
  const channels = color => color.startsWith("#")
    ? [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16))
    : color.match(/[\d.]+/g).map(Number);
  const maximumDelta = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
  for (const style of ["dark", "light"]) for (const p of [.375, .5, .829, .951]) {
    let previous;
    for (let i = 0; i <= 1000; i++) {
      const dark = i / 1000, drawing = theme.sceneDrawing(p, style, dark);
      const values = [theme.sceneInk(dark), drawing.ringBase, drawing.tickOpacity,
        ...channels(theme.sceneForeground(1 - dark)),
        ...[drawing.landColor, drawing.ringHighlight, drawing.tickColor].flatMap(channels)];
      assert.ok(values.every(Number.isFinite));
      if (previous) assert.ok(maximumDelta(values, previous) <= 1.01, `Material flashed at ${dark}`);
      previous = values;
    }
  }
  for (const p of [.52, .62, .72]) for (const paper of [0, 1]) {
    let previous = channels(theme.sceneAccent(p - .004, paper));
    for (let i = 1; i <= 800; i++) {
      const current = channels(theme.sceneAccent(p - .004 + i * .00001, paper));
      assert.ok(maximumDelta(current, previous) <= 1, `Accent flashed at ${p}`);
      previous = current;
    }
  }
  assert.equal(theme.sceneInk(0), 25); assert.equal(theme.sceneInk(1), 248);
  assert.equal(theme.sceneForeground(0), theme.sceneColors.foreground);
  assert.equal(theme.sceneForeground(1), "#302e2d");
});

test("assembly reflections crest at closure, settle back to normal and reverse exactly", () => {
  const target = recordingCanvas();
  const renderer = createEarthRenderer(target.canvas, { autoStart: false });
  const reflectedAlpha = p => {
    target.capture(renderer, p);
    let alpha = 1, fill, maximum = 0;
    const stack = [];
    for (const [kind, value] of target.commands) {
      if (kind === "save") stack.push([alpha, fill]);
      else if (kind === "restore") [alpha, fill] = stack.pop();
      else if (kind === "globalAlpha") alpha = value;
      else if (kind === "fillStyle") fill = value;
      else if (kind === "fillRect" && fill?.stops) maximum = Math.max(maximum, alpha);
    }
    return maximum;
  };
  const rest = reflectedAlpha(.5);
  for (const p of [.42, .938]) {
    assert.ok(reflectedAlpha(p) > rest * 5, "Closure lost the reflective glass crest");
    const before = target.capture(renderer, p, 5);
    target.capture(renderer, .975, 8);
    assert.equal(target.capture(renderer, p, 5), before, "Reverse seeking retained the dimmed material");
  }
  assert.equal(reflectedAlpha(.975), rest, "Assembly stayed overlit instead of settling");
  renderer.setReducedMotion(true);
  assert.equal(reflectedAlpha(.938), rest, "Reduced motion retained the optical pulse");
  renderer.destroy();
});

test("continental spread adds separation without changing the turn or the closed globe", () => {
  for (const [index, plate] of createContinentalPlates([]).entries()) {
    for (const phase of [0, .2, .5, .8, 1]) {
      const a = continentalPose(plate, phase, index, 1, 4, 1);
      const b = continentalPose(plate, phase, index, 1, 4, siteConfig.effects.continentalDrift.spread);
      if (phase === 0 || phase === 1) assert.deepEqual(a, b);
      else {
        const distance = p => Math.hypot(p.center.x - plate.pivot.x, p.center.y - plate.pivot.y, p.center.z - plate.pivot.z);
        assert.ok(Math.abs(distance(b) - distance(a) * siteConfig.effects.continentalDrift.spread) < 1e-10);
        for (const key of ["local", "normal", "x", "y", "z", "flatten"]) assert.deepEqual(a[key], b[key]);
      }
    }
  }
});

test("reading clearance uses actual triangles and text lines, not their empty bounding boxes", () => {
  const bounds = { left: 64, right: 400, top: 64, bottom: 360 };
  const diagonal = [{ points: [{ x: 250, y: 610 }, { x: 640, y: 100 }, { x: 680, y: 680 }] }];
  assert.equal(fitBesideReading(diagonal, 720, 450, 1, bounds), 1, "An empty triangle corner forced a zoom-out");
  const gap = [{ points: [{ x: 250, y: 340 }, { x: 270, y: 345 }, { x: 260, y: 355 }] }];
  const lines = [{ left: 64, right: 400, top: 100, bottom: 160 }, { left: 64, right: 180, top: 500, bottom: 520 }];
  assert.equal(fitBesideReading(gap, 720, 450, 1, { ...bounds, bottom: 520, lines }), 1, "The blank space between tool entries forced a zoom-out");
  assert.ok(fitBesideReading(gap, 720, 450, 1, { ...bounds, bottom: 520 }) < 1);
});

test("camera framing uses space below measured copy and refreshes after reading bounds change", () => {
  const bounds = { left: 64, right: 400, top: 64, bottom: 360 };
  const beside = [{ points: [{ x: 250, y: 180 }, { x: 290, y: 180 }, { x: 280, y: 240 }] }];
  const below = [{ points: [{ x: 250, y: 610 }, { x: 290, y: 610 }, { x: 280, y: 680 }] }];
  assert.ok(fitBesideReading(beside, 720, 450, 1, bounds) < 1);
  assert.equal(fitBesideReading(below, 720, 450, 1, bounds), 1);
  const target = recordingCanvas(), fresh = recordingCanvas();
  const a = createEarthRenderer(target.canvas, { autoStart: false, toolsBounds: bounds });
  const expanded = { ...bounds, right: 500, bottom: 650 };
  const b = createEarthRenderer(fresh.canvas, { autoStart: false, toolsBounds: expanded });
  const before = target.capture(a, .895);
  a.setToolsBounds(expanded);
  assert.equal(target.capture(a, .895), fresh.capture(b, .895));
  assert.notEqual(before, target.capture(a, .895));
  a.destroy(); b.destroy();

  const lines = [{ ...expanded }];
  const reflowed = { ...expanded, lines: [{ ...expanded, right: 300 }] };
  const cached = recordingCanvas(), uncached = recordingCanvas();
  const c = createEarthRenderer(cached.canvas, { autoStart: false, toolsBounds: { ...expanded, lines } });
  const d = createEarthRenderer(uncached.canvas, { autoStart: false, toolsBounds: reflowed });
  const wide = cached.capture(c, .895);
  c.setToolsBounds(reflowed);
  assert.equal(cached.capture(c, .895), uncached.capture(d, .895), "Changed text lines left a stale framing cache");
  assert.notEqual(wide, cached.capture(c, .895));
  c.destroy(); d.destroy();
});

// Record drawing commands to test cache invalidation without a browser or a
// native Canvas dependency. Pixel fidelity is checked separately in Chrome.
function recordingCanvas(width = 1440, height = 900) {
  const commands = [];
  let state = { globalAlpha: 1 }, stack = [];
  const canvas = { width, height, getContext: () => context };
  const gradient = (...args) => ({ args, stops: [], addColorStop(...stop) { this.stops.push(stop); } });
  const methods = {
    save() { stack.push({ ...state }); commands.push(["save"]); },
    restore() { state = stack.pop(); commands.push(["restore"]); },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    measureText: text => ({ width: text.length * 7 }),
  };
  const context = new Proxy({}, {
    get(_target, key) {
      if (key === "canvas") return canvas;
      if (key in state) return state[key];
      return methods[key] ?? ((...args) => {
        for (const value of args) if (typeof value === "number") assert.ok(Number.isFinite(value), `${key} received ${value}`);
        commands.push([key, ...args]);
      });
    },
    set(_target, key, value) { state[key] = value; commands.push([key, value]); return true; },
  });
  return {
    canvas, commands,
    capture(renderer, p, time = 3) {
      commands.length = 0;
      renderer.drawAtProgress(p, time);
      return createHash("sha256").update(JSON.stringify(commands)).digest("hex");
    },
  };
}

test("Tools rotates in each ring's plane without shifting its axis or winding up on scroll", () => {
  const point = { x: .6, y: .8, z: .75 };
  for (const time of [0, 3, 10, 60, 6000]) {
    const angle = -.42 + time * .12;
    const pose = axialRotation(angle, 1);
    const spun = rotate(point, pose);
    assert.ok(Math.abs(spun.z - point.z) < 1e-12, "A slice turned out of its ring's plane");
    assert.ok(Math.abs(Math.hypot(spun.x, spun.y) - 1) < 1e-12, "The circular orbit changed size");
    const center = rotate({ x: 0, y: 0, z: .75 }, pose);
    assert.ok(Math.hypot(center.x, center.y) < 1e-12, "A slice center orbited away from the axis");
    for (const opening of [.1, .4, .7]) {
      const a = rotate(point, axialRotation(angle, opening));
      const b = rotate(point, axialRotation(angle, opening + .0001));
      assert.ok(Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z) < .001, "Scroll unwound accumulated rotation time");
    }
  }
});

test("Tools triangles and attached map dots keep moving with scroll held still", () => {
  for (const style of ["dark", "light"]) for (const width of [1440, 390]) {
    const target = recordingCanvas(width);
    const renderer = createEarthRenderer(target.canvas, {
      autoStart: false, style, landPoints: [[-122, 37], [18, 0], [80, 30], [135, -25]],
    });
    const geometry = (p, time) => {
      target.capture(renderer, p, time);
      const triangles = [], dots = [];
      let path = [];
      for (const [kind, ...args] of target.commands) {
        if (kind === "beginPath") path = [];
        else if (["moveTo", "lineTo", "closePath", "arc"].includes(kind)) path.push([kind, ...args]);
        else if (kind === "fill" && path.map(p => p[0]).join() === "moveTo,lineTo,lineTo,closePath") triangles.push(path);
        else if (kind === "fill") for (const entry of path) if (entry[0] === "arc") dots.push(entry.slice(1, 3));
      }
      // A face receives a base coat and an optical pass. Count its geometry
      // once, rather than treating a reflection appearing as a new fragment.
      return { triangles: [...new Map(triangles.map(p => [JSON.stringify(p), p])).values()], dots };
    };
    for (const p of [.875, .88, .89]) {
      const before = geometry(p, 2), after = geometry(p, 5);
      assert.ok(before.triangles.length > 100 && before.dots.length > 0);
      assert.equal(after.triangles.length, before.triangles.length, "Rotation dropped mirror fragments");
      assert.notDeepEqual(after.triangles, before.triangles, "Only the lighting moved; the Tools geometry was frozen");
      assert.notDeepEqual(after.dots, before.dots, "The map was left behind while its shards rotated");
      renderer.drawAtProgress(.92, 30);
      assert.deepEqual(geometry(p, 2), before, "Reverse seeking retained a later spin pose");
      let fixedRing;
      for (const time of [0, 3, 12, 25, 40, 52]) {
        const fullTurn = geometry(p, time);
        // The first path belongs to the stationary rear circle, before glints.
        const circlePoint = target.commands.find(([kind]) => kind === "moveTo");
        if (fixedRing) assert.deepEqual(circlePoint, fixedRing, "Auto-fit made the ring move while its shards spun");
        fixedRing = circlePoint;
        for (const triangle of fullTurn.triangles) for (const [kind, x, y] of triangle) if (kind !== "closePath") {
          assert.ok(x >= 15.99 && x <= width - 15.99 && y >= 23.99 && y <= 900 - (width < 900 ? 83.99 : 23.99), "A rotating shard escaped the fitted viewport");
        }
      }
    }
    renderer.setReducedMotion(true);
    assert.deepEqual(geometry(.88, 2), geometry(.88, 5), "Reduced motion kept rotating the geometry");
    renderer.destroy();
  }
});

test("eight axial connections remain visible across the fully fractured assembly", () => {
  for (const style of ["dark", "light"]) {
    const target = recordingCanvas();
    const renderer = createEarthRenderer(target.canvas, { autoStart: false, style });
    for (const p of [.875, .88, .89]) {
      target.capture(renderer, p);
      let path = [], color = "", width = 0, connections = 0;
      for (const [command, ...args] of target.commands) {
        if (command === "beginPath") path = [];
        else if (["moveTo", "lineTo", "closePath", "arc", "ellipse"].includes(command)) path.push([command, ...args]);
        else if (command === "strokeStyle") color = args[0];
        else if (command === "lineWidth") width = args[0];
        else if (command === "stroke" && width === .65 && path.length > 0 && path.length <= 16 && path.length % 2 === 0 && path.every(([kind], i) => kind === (i % 2 ? "lineTo" : "moveTo"))) {
          const alpha = Number(String(color).match(/,([^,]+)\)$/)?.[1]);
          if (alpha > .05) connections += path.length / 2;
        }
      }
      assert.equal(connections, 8, `The assembly's connecting lines disappeared at ${p}`);
    }
    renderer.destroy();
  }
});

test("Tools mirror glints taper along individual edges instead of whitening whole triangles", () => {
  const target = recordingCanvas();
  const renderer = createEarthRenderer(target.canvas, { autoStart: false });
  target.capture(renderer, .88, 3);
  let path = [], paint, reflections = 0;
  for (const [kind, ...args] of target.commands) {
    if (kind === "beginPath") path = [];
    else if (["moveTo", "lineTo", "closePath"].includes(kind)) path.push(kind);
    else if (kind === "strokeStyle") paint = args[0];
    else if (kind === "stroke" && paint?.stops) {
      reflections++;
      assert.deepEqual(path, ["moveTo", "lineTo"], "A specular reflection outlined a complete white triangle");
      assert.equal(paint.stops[0][1], "rgba(255,255,255,0)");
      assert.equal(paint.stops.at(-1)[1], "rgba(255,255,255,0)");
    }
  }
  assert.ok(reflections > 0, "The mirror highlights were removed instead of corrected");
  renderer.destroy();
});

test("geographic mirror fragments retain all map samples and reassemble exactly", async () => {
  const source = JSON.parse(await readFile(resolve(root, "lib/land-points.json"), "utf8"));
  const land = source.map(([lon,lat]) => spherePoint(lon*Math.PI/180, lat*Math.PI/180, 1.004));
  const plates = createContinentalPlates(land);
  assert.equal(new Set(plates.flatMap(p=>p.dots)).size, land.length);
  assert.equal(plates.reduce((n,p)=>n+p.dots.length,0), land.length);
  assert.ok(plates.length > 50, 'Whole continents must not substitute for fragments');
  const regionIds = [...new Set(plates.map(p => p.region))];
  for (const [lon,lat,id] of [[18,0,'africa'],[-100,40,'north-america'],[-60,-20,'south-america'],[12,48,'europe'],[100,40,'asia'],[135,-25,'oceania'],[0,-80,'antarctica']]) assert.equal(regionIds[continentalRegion(lon,lat)],id);
  const distance = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  plates.forEach((plate,index)=>{
    for (const phase of [0,.1,.4,.8,1,.4,0]) {
      const pose=continentalPose(plate,phase,index);
      const samples=[...plate.vertices.filter((_,i)=>i%31===0),...plate.dots.filter((_,i)=>i%23===0)];
      for (const point of samples) {
        const moved=transformContinentalPoint(point,pose);
        if (phase===.4) {
          const relative={x:moved.x-pose.center.x,y:moved.y-pose.center.y,z:moved.z-pose.center.z};
          assert.ok(Math.abs(relative.x*pose.normal.x+relative.y*pose.normal.y+relative.z*pose.normal.z)<1e-10,'A map sample left its mirror plane');
        }
        if (phase===0||phase===1) assert.ok(distance(moved,point)<1e-12,'A region failed to reassemble');
      }
      plate.contours.forEach(contour=>contour.forEach(i=>assert.ok(i>=0&&i<plate.vertices.length)));
    }
  });
});

test("open mirrors continue turning at fixed scroll and stop deforming at both endpoints",()=>{
  const plates=createContinentalPlates([]);
  let moving=0;
  plates.forEach((plate,index)=>{
    const pose=continentalPose(plate,.5,index,1,2), later=continentalPose(plate,.5,index,1,5);
    if(Math.hypot(pose.normal.x-later.normal.x,pose.normal.y-later.normal.y,pose.normal.z-later.normal.z)>.1) moving++;
    for(const phase of [0,1]) for(const vertex of plate.vertices) {
      const a=transformContinentalPoint(vertex,continentalPose(plate,phase,index,1,2));
      const b=transformContinentalPoint(vertex,continentalPose(plate,phase,index,1,5));
      assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-12);
    }
  });
  assert.ok(moving>plates.length*.8,'Most shards were visually stationary');
});

test("continental caches survive reverse seeking, resizing, reduced motion and destruction",()=>{
  const target=recordingCanvas();
  const options={autoStart:false,continentalDrift:{ranges:[[.42,.52]],amplitude:1},landPoints:[[18,0],[-60,-20],[90,40]]};
  const renderer=createEarthRenderer(target.canvas,options);
  for(const width of [1440,390,1280]) for(const reducedMotion of [false,true,false]) {
    target.canvas.width=width;renderer.resize();renderer.setReducedMotion(reducedMotion);
    const fresh=recordingCanvas(width),reference=createEarthRenderer(fresh.canvas,{...options,reducedMotion});
    for(const p of [.43,.47,.5,.48,.42,.48]) {
      renderer.drawAtProgress(.875,15);
      assert.equal(target.capture(renderer,p),fresh.capture(reference,p),`Continental cache stale at ${width}/${p}/${reducedMotion}`);
    }
    reference.destroy();
  }
  renderer.destroy();target.commands.length=0;renderer.drawAtProgress(.47);renderer.setProgress(.49);renderer.resize();
  assert.equal(target.commands.length,0);
});

test("Tools shares drawing rules while preserving each preset's approved background", () => {
  for (const p of [.855, .875, .9, .92]) {
    const drawings = ["dark", "light"].map(style => theme.sceneDrawing(p, style, 1 - theme.sceneLight(p, style)));
    assert.deepEqual(drawings[0], drawings[1]);
    assert.equal(drawings[0].rimOpacity, 0);
    assert.equal(theme.sceneBackground(theme.sceneLight(p, "dark"), "dark"), "rgb(218 213 208)");
    assert.equal(theme.sceneBackground(theme.sceneLight(p, "light"), "light"), "rgb(255 255 255)");
  }
});

test("Tools rules do not remove the homepage's shared accents or black-and-white foundation", () => {
  assert.equal(theme.sceneBackground(theme.sceneLight(0, "light"), "light"), "rgb(255 255 255)");
  assert.equal(theme.sceneBackground(theme.sceneLight(.6, "light"), "light"), "rgb(8 8 8)");
  for (const style of ["dark", "light"]) {
    const home = theme.sceneDrawing(0, style, 1 - theme.sceneLight(0, style));
    assert.equal(home.rimOpacity, 1);
    assert.equal(new Set(home.rimColors).size, 8);
  }
  const dark = theme.themeVariables("dark"), light = theme.themeVariables("light");
  for (const key of ["--accent", "--accent-red", "--accent-orange", "--accent-green", "--accent-cyan", "--cursor-preview"]) {
    assert.equal(dark[key], light[key]);
  }
});

test("entering and leaving Tools changes drawing strength continuously", () => {
  for (const start of [.819, .919]) {
    let previous;
    for (let p = start; p < start + .04; p += .0001) {
      const drawing = theme.sceneDrawing(p, "light", 1 - theme.sceneLight(p, "light"));
      if (previous) for (const key of ["paper", "rimOpacity", "faceDefinition", "landOpacity"]) {
        assert.ok(Math.abs(drawing[key] - previous[key]) < .02, `${key} jumped at ${p}`);
      }
      previous = drawing;
    }
  }
});

test("timeline seeking round-trips every chapter and both endpoints at unequal heights", () => {
  const sizes = [{ start: 0, end: 2600 }, { start: 2600, end: 6200 }, { start: 6200, end: 8400 }, { start: 8400, end: 9900 }];
  const distance = 9000;
  assert.equal(progress.chapterScrollPosition(-1, sizes, distance), 0);
  assert.equal(progress.chapterScrollPosition(2, sizes, distance), distance);
  for (let i = 0; i <= 100; i++) {
    const position = i / 100;
    const y = progress.chapterScrollPosition(position, sizes, distance);
    const { index, local } = progress.locateChapter(y, sizes, distance);
    assert.ok(Math.abs((index + local) / sizes.length - position) < .0003);
  }
  assert.deepEqual(progress.locateChapter(distance, sizes, distance), { index: 3, local: 1 });
});

test("research count changes keep chapter order and the complete progress range", () => {
  for (const count of [1, 3, 5]) {
    const ranges = progress.chapterRanges(count);
    assert.equal(ranges.length, count + 4);
    assert.deepEqual(ranges.at(-2), [.82, .94]);
    assert.equal(ranges.at(-1)[1], 1);
    ranges.forEach(([start, end], i) => {
      assert.ok(end > start);
      if (i) assert.ok(Math.abs(start - ranges[i - 1][1]) < 1e-10);
    });
  }
});

test("document scroll reaches exact endpoints after a viewport resize", () => {
  for (const viewport of [390, 844, 768, 900]) {
    const sizes = [2.5, 3, 7, 3, 3, 3, 3, 2].reduce((items, screens) => {
      const start = items.at(-1)?.end ?? 0;
      items.push({ start, end: start + screens * viewport });
      return items;
    }, []);
    const distance = sizes.at(-1).end - viewport;
    const first = progress.locateChapter(0, sizes, distance);
    const last = progress.locateChapter(distance, sizes, distance);
    assert.deepEqual(first, { index: 0, local: 0 });
    assert.deepEqual(last, { index: sizes.length - 1, local: 1 });
  }
});

test("mobile text and figures are readable only while the centered scene is suppressed", () => {
  for (const figure of [false, true]) for (const reduced of [false, true]) {
    for (let phase = -1; phase <= 2; phase += .001) {
      const panel = progress.readingPanel(phase, figure, reduced);
      assert.ok(panel.opacity >= 0 && panel.opacity <= panel.envelope + 1e-10);
      if (panel.opacity > .001) assert.equal(panel.envelope, 1);
      if (reduced) assert.equal(panel.shift, 0);
    }
  }
  assert.equal(progress.readingPanel(.15, false, false).opacity, 1);
  assert.equal(progress.readingPanel(.55, false, false).envelope, 0);
  assert.equal(progress.readingPanel(.8, true, false).opacity, 1);
});

test("cached geometry remains identical after arbitrary chapter history and reverse scrolling", () => {
  for (const style of ["dark", "light"]) {
    const fresh = recordingCanvas(), reused = recordingCanvas();
    const options = { style, autoStart: false, landPoints: [[-122.273, 37.8715], [12.5, 41.9], [151.2, -33.9]] };
    const a = createEarthRenderer(fresh.canvas, options), b = createEarthRenderer(reused.canvas, options);
    for (const p of [0, .17, .2, .28, .32, .375, .405, .48, .85, .875, .895, .914, .934, .95, .88, .86, .375, .2, 0]) {
      b.drawAtProgress(.7, 9);
      assert.equal(reused.capture(b, p), fresh.capture(a, p), `Stale geometry at ${p} (${style})`);
    }
    a.destroy(); b.destroy();
  }
});

test("geometry caches survive desktop/mobile resizing and reduced-motion changes", () => {
  const target = recordingCanvas();
  const renderer = createEarthRenderer(target.canvas, { autoStart: false });
  for (const [width, reducedMotion] of [[390, false], [1440, true], [1440, false]]) {
    target.canvas.width = width;
    renderer.resize(); renderer.setReducedMotion(reducedMotion);
    const fresh = recordingCanvas(width);
    const reference = createEarthRenderer(fresh.canvas, { autoStart: false, reducedMotion });
    for (const p of [.2, .86, .88, .895, 0]) assert.equal(target.capture(renderer, p), fresh.capture(reference, p));
    reference.destroy();
  }
  renderer.destroy();
});

test("destroyed renderers cannot resume drawing or recreate caches", () => {
  const target = recordingCanvas();
  const renderer = createEarthRenderer(target.canvas, { autoStart: false });
  renderer.drawAtProgress(.88);
  renderer.destroy();
  target.commands.length = 0;
  renderer.setProgress(.86); renderer.setPaused(false); renderer.setIntroProgress(1);
  renderer.setSuspended(true); renderer.setSuspended(false);
  renderer.setMobileLayout({ centerY: 280, radius: 98 });
  renderer.resize(); renderer.drawAtProgress(.2); renderer.destroy();
  assert.equal(target.commands.length, 0);
});

test("hidden stages retain updates without drawing and resume at the latest viewport and pose", () => {
  const target = recordingCanvas();
  const renderer = createEarthRenderer(target.canvas, { autoStart: false });
  renderer.drawAtProgress(.875);
  renderer.setPaused(true);
  renderer.setSuspended(true);
  target.commands.length = 0;
  for (let i = 0; i < 24; i++) renderer.setProgress(.832 + i * .001);
  renderer.setIntroProgress(.9);
  renderer.setReducedMotion(true);
  renderer.setReducedMotion(false);
  target.canvas.width = 390; target.canvas.height = 844;
  renderer.resize();
  const layout = { centerY: 380, radius: 120 };
  renderer.setMobileLayout(layout);
  renderer.drawAtProgress(.895, 4);
  assert.equal(target.commands.length, 0, "A fully hidden stage was still drawing");
  renderer.setSuspended(false);
  assert.ok(target.commands.length > 0, "The latest scene was not restored");
  const resumed = createHash("sha256").update(JSON.stringify(target.commands)).digest("hex");
  const fresh = recordingCanvas(390, 844);
  const reference = createEarthRenderer(fresh.canvas, { autoStart: false, introProgress: .9 });
  reference.setMobileLayout(layout);
  assert.equal(resumed, fresh.capture(reference, .895, 4));
  renderer.destroy(); reference.destroy();
});

test("all geographic dots belong to a glass shard and stay on its plane when tilted", async () => {
  const land = JSON.parse(await readFile(resolve(root, "lib/land-points.json"), "utf8"));
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  for (const mobile of [false, true]) {
    const points = land.filter((_, i) => !mobile || i % 2 === 0).map(([lon, lat]) => spherePoint(lon * Math.PI / 180, lat * Math.PI / 180, 1.004));
    const shards = createGlassShards(createGlassShell(mobile ? 16 : 24, mobile ? 8 : 12), points);
    assert.equal(shards.reduce((count, shard) => count + shard.dots.length, 0), points.length);
    for (const shard of shards) {
      for (const split of [0, .4, 1, .7, 0]) {
        const pose = glassShardPose(shard, split);
        const vertices = shard.vertices.map(p => transformShardPoint(p, pose));
        if (!split) vertices.forEach((p, i) => assert.ok(Math.hypot(...["x", "y", "z"].map(axis => p[axis] - shard.face.points[i][axis])) < 1e-12));
        const [a, b, c] = vertices, ab = sub(b, a), ac = sub(c, a);
        const aa = dot(ab, ab), bb = dot(ac, ac), cross = dot(ab, ac), inverse = 1 / (aa * bb - cross * cross);
        const normal = { x: ab.y * ac.z - ab.z * ac.y, y: ab.z * ac.x - ab.x * ac.z, z: ab.x * ac.y - ab.y * ac.x };
        for (const point of shard.dots) {
          const relative = sub(transformShardPoint(point, pose), a);
          assert.ok(Math.abs(dot(relative, normal)) < 1e-10, "A map dot left its glass plane");
          const u = dot(relative, ab), v = dot(relative, ac);
          const wb = (bb * u - cross * v) * inverse, wc = (aa * v - cross * u) * inverse;
          assert.ok(wb >= -1e-6 && wc >= -1e-6 && wb + wc <= 1 + 1e-6, "A map dot left its triangle");
        }
      }
    }
  }
});

test("fracture is confined to Tools and keeps both style presets' drawings identical", () => {
  for (const reducedMotion of [false, true]) for (const style of ["dark", "light"]) {
    const on = recordingCanvas(), off = recordingCanvas();
    const options = { autoStart: false, reducedMotion, style };
    const a = createEarthRenderer(on.canvas, options), b = createEarthRenderer(off.canvas, { ...options, fracturedGlass: false });
    for (const p of [0, .15, .28, .4, .6, .81, .82, .94, .99]) assert.equal(on.capture(a, p), off.capture(b, p), `Fracture leaked into ${p}`);
    if (reducedMotion) assert.equal(on.capture(a, .88), off.capture(b, .88));
    else assert.notEqual(on.capture(a, .88), off.capture(b, .88));
    a.destroy(); b.destroy();
  }
  const dark = recordingCanvas(), light = recordingCanvas();
  const a = createEarthRenderer(dark.canvas, { autoStart: false, style: "dark" });
  const b = createEarthRenderer(light.canvas, { autoStart: false, style: "light" });
  for (const p of [.855, .875, .88, .895, .92]) assert.equal(dark.capture(a, p), light.capture(b, p));
  a.destroy(); b.destroy();
});

test("open Research sheets ignore hidden globe rotation but preserve the complete closing fold", () => {
  const target = recordingCanvas(), layers = createResearchLayers();
  let projections = 0;
  const capture = (amount, yaw) => {
    target.commands.length = 0; projections = 0;
    layers.draw(target.canvas.getContext("2d"), {
      amount, clock: 3, mobile: false, dark: 0, poseKey: .27,
      plane: p => p,
      globe: p => { projections++; return rotate(p, rotation(yaw, .12)); },
      project: p => ({ x: 720 + p.x * 220, y: 450 - p.y * 220, z: p.z, perspective: 1 }),
    });
    return createHash("sha256").update(JSON.stringify(target.commands)).digest("hex");
  };
  const open = capture(1, 0);
  assert.equal(projections, 0, "Fully open sheets still projected the hidden globe");
  assert.equal(capture(1, 2), open, "Hidden globe rotation moved the open terrain");
  const unfolded = capture(.86, 0);
  assert.equal(capture(.86, 2), unfolded, "Hidden globe rotation leaked into the unfolded endpoint");
  const folding = capture(.70, 0);
  assert.ok(projections > 0, "The closing sheets lost their spherical targets");
  assert.notEqual(capture(.70, 2), folding, "The reassembly no longer follows its globe pose");
  assert.equal(capture(1, 2), open, "Reverse seeking changed the open field");
  layers.destroy();
});

test("drawing-stage captions come from the author's options, never from the renderer", () => {
  const captions = layerLabels => {
    const target = recordingCanvas();
    const renderer = createEarthRenderer(target.canvas, { autoStart: false, layerLabels });
    target.capture(renderer, .3);
    renderer.destroy(false);
    return target.commands.filter(([command]) => command === "fillText").map(([, label]) => label);
  };
  assert.deepEqual(captions(undefined), [], "An unlabeled profile still drew captions");
  assert.deepEqual(captions(["Design", "Code"]), ["Design", "Code"]);
  assert.deepEqual(captions(["a", "b", "c", "d", "e"]), ["a", "b", "c", "d"], "More than four sheets were captioned");
});

test("a hand-turned globe changes only the opening and returns the same frame after a whole turn", () => {
  const target = recordingCanvas();
  const renderer = createEarthRenderer(target.canvas, { autoStart: false, landPoints: [[18, 0], [-60, -20], [90, 40]] });
  const at = (p, yaw) => { renderer.setSpin(yaw); return target.capture(renderer, p); };
  const rest = at(0, 0);
  assert.notEqual(at(0, .6), rest, "Turning the opening globe drew nothing new");
  assert.equal(at(0, 0), rest);
  assert.equal(progress.heroSpin(0), 1);
  for (const p of [.1, .2, .47, .7, .88, .97]) {
    assert.equal(progress.heroSpin(p), 0);
    const untouched = at(p, 0);
    assert.equal(at(p, 2.4), untouched, `A hand-turned yaw reached the scene at ${p}`);
  }
  renderer.setReducedMotion(true);
  const still = at(0, 0);
  assert.equal(at(0, 1.2), still, "Reduced motion still turned the globe");
  renderer.destroy(false);
});

test("the scroll position owns the continents: they open as a chapter arrives and close as it leaves", () => {
  const span = .4 / 4;
  const at = (chapter, offset) => progress.continentalScroll(.42 + (chapter + offset) * span, 4);
  const open = phase => phase > .13 && phase < .91;
  for (let chapter = 0; chapter < 4; chapter++) {
    assert.ok(open(at(chapter, .12)), `Chapter ${chapter} is closed while its copy is in place`);
    assert.ok([0, 1].includes(at(chapter, .5)), `Chapter ${chapter} is still open half-way to the next`);
  }
  for (let chapter = 1; chapter < 4; chapter++) assert.ok([0, 1].includes(at(chapter, -.5)), `Chapter ${chapter} opened before the turn`);
  assert.equal(progress.continentalScroll(.41, 4), 0, "The first chapter opened before the globe re-formed");
  let previous = 0;
  for (let p = .40; p <= .83; p += .0005) {
    const phase = progress.continentalScroll(p, 4);
    assert.ok(phase >= 0 && phase <= 1);
    // A phase that wraps from 1 to 0 is the same intact globe; inside a chapter it only moves gently.
    if (!(previous === 1 && phase === 0)) assert.ok(Math.abs(phase - previous) < .03, `The separation jumped at ${p.toFixed(4)}`);
    previous = phase;
  }
  assert.equal(progress.continentalScroll(.47, 4), progress.continentalScroll(.47, 4), "The same scroll position gave two phases");
  assert.ok(open(progress.continentalScroll(.43 + .0, 4, 1) || progress.continentalScroll(.44, 4, 1)));
  for (const p of [.55, .65, .75]) assert.equal(progress.continentalScroll(p, 4, 1), 0, "A chapter beyond the configured ones opened");
});

test("each project chapter turns its own part of the world to the reader, always the same way round", () => {
  const longitude = yaw => { const d = ((.18 - yaw) * 180) / Math.PI; return Math.round(((((d + 180) % 360) + 360) % 360) - 180); };
  assert.deepEqual([0, 1, 2, 3].map(i => longitude(progress.galleryFace(i))), [32, 100, 148, -80], "Chapters no longer face Africa, Asia, Oceania and the Americas");
  assert.ok(Math.abs(progress.galleryFace(4) - (progress.galleryFace(0) - Math.PI * 2)) < 1e-9, "A fifth chapter must repeat the first face one full turn on");
  const span = .4 / 4;
  let previous = Infinity;
  for (let p = progress.facingAnchor; p <= .835; p += .0025) {
    const yaw = progress.galleryYaw(p, 4);
    assert.ok(yaw <= previous + 1e-9, `The globe turned back at ${p.toFixed(4)}`);
    assert.ok(previous === Infinity || previous - yaw < .25, `The globe jumped at ${p.toFixed(4)}`);
    previous = yaw;
  }
  for (let chapter = 0; chapter < 4; chapter++)
    for (const offset of [0, .15, .3])
      assert.ok(Math.abs(progress.galleryYaw(.42 + (chapter + offset) * span, 4) - progress.galleryFace(chapter)) < 1e-9, `Chapter ${chapter} left its face while its copy is in place`);
});

test("project chapters draw different land, repeat exactly, and keep still for reduced motion", () => {
  const land = [[18, 0], [-60, -20], [90, 40], [140, -25], [-100, 45], [30, 50]];
  const drift = { ranges: progress.chapterRanges(4).slice(2, 6), amplitude: .55, spread: .9 };
  const draw = (p, t, extra = {}) => {
    const target = recordingCanvas();
    const renderer = createEarthRenderer(target.canvas, { autoStart: false, projectCount: 4, landPoints: land, continentalDrift: drift, ...extra });
    const digest = target.capture(renderer, p, t);
    renderer.destroy(false);
    return digest;
  };
  assert.equal(new Set([.432, .532, .632, .732].map(p => draw(p, 2))).size, 4, "Project chapters drew the same scene");
  assert.equal(draw(.532, 2), draw(.532, 2), "The same scroll position and time drew two different frames");
  assert.notEqual(draw(.532, 2), draw(.532, 2, { continentalDrift: false }), "The continents never left the globe");
  assert.equal(draw(.57, 2), draw(.57, 2, { continentalDrift: false }), "Half-way to the next chapter the globe must be whole");
  assert.equal(draw(.532, 2, { reducedMotion: true }), draw(.532, 2, { reducedMotion: true, continentalDrift: false }), "Reduced motion still separated the continents");
  for (const p of [0, .2, .875, .94]) assert.equal(draw(p, 2), draw(p, 2, { continentalDrift: false }), `The separation escaped the project chapters at ${p}`);
});

test("the Tools slices wind in by whole turns, the inner ones furthest", () => {
  for (let slice = 0; slice < 4; slice++) {
    assert.equal(progress.toolsVortex(progress.toolsMotion.close, slice), 0);
    assert.ok(Number.isInteger(progress.toolsVortex(progress.toolsMotion.assembled, slice)), "A slice came home out of register");
  }
  assert.ok(progress.toolsVortex(.915, 2) > progress.toolsVortex(.915, 1));
  assert.equal(progress.toolsVortex(.915, 0), 0, "The outer slice keeps to the shared turn");
  assert.equal(progress.toolsVortex(.915, 1), progress.toolsVortex(.915, 3), "The stack must wind symmetrically");
  const draw = p => {
    const target = recordingCanvas();
    const renderer = createEarthRenderer(target.canvas, { autoStart: false, landPoints: [[18, 0], [-60, -20], [90, 40]] });
    const digest = target.capture(renderer, p, 2);
    renderer.destroy(false);
    return digest;
  };
  assert.notEqual(draw(.91), draw(.915), "The closing assembly did not move");
  assert.equal(draw(.944), draw(.944));
});

test("every lane draws whole frames from one clock, and a late frame never replaces a newer one", async () => {
  const { createEarthRuntime, sceneLanes } = await load("lib/earth-runtime.ts");
  assert.deepEqual([1, 4, 7, 8, 12, 16, 64].map(sceneLanes), [1, 1, 1, 2, 3, 3, 3]);
  const names = ["window", "document", "navigator", "Worker", "OffscreenCanvas", "ResizeObserver", "IntersectionObserver", "requestAnimationFrame", "cancelAnimationFrame"];
  const originals = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  const workers = [], frames = [];
  let now = performance.now() + 5;
  class WorkerMock {
    constructor() { this.sent = []; workers.push(this); }
    postMessage(message) {
      this.sent.push(structuredClone(message));
      if (message.type === "init") queueMicrotask(() => this.onmessage({ data: { type: "ready" } }));
    }
    finish(id, duration = 30) { this.onmessage({ data: { type: "frame", id, duration, bitmap: { width: 4, height: 4, close() { this.closed = true; } } } }); }
    terminate() { this.terminated = true; }
  }
  class ObserverMock { observe() {} disconnect() {} }
  const step = async (ms = 7) => { now += ms; const queue = frames.splice(0); for (const callback of queue) callback(now); await Promise.resolve(); };
  let renderer;
  try {
    for (const [name, value] of Object.entries({
      window: { devicePixelRatio: 3, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} },
      document: { hidden: false, addEventListener() {}, removeEventListener() {} },
      navigator: { hardwareConcurrency: 16 },
      Worker: WorkerMock, OffscreenCanvas: class {}, ResizeObserver: ObserverMock, IntersectionObserver: ObserverMock,
      requestAnimationFrame: callback => frames.push(callback), cancelAnimationFrame() {},
    })) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    const { canvas, commands: calls } = recordingCanvas();
    canvas.dataset = {};
    canvas.getBoundingClientRect = () => ({ width: 1440, height: 900 });
    renderer = await createEarthRuntime(canvas, {});
    await Promise.resolve(); await Promise.resolve();
    assert.equal(workers.length, 3, "A 16-thread device should open three lanes");
    assert.equal(canvas.dataset.renderThread, "worker");
    const sentFrames = () => workers.flatMap(worker => worker.sent.filter(message => message.type === "frame"));
    renderer.setProgress(.35); renderer.setProgress(.375);
    assert.equal(sentFrames().length, 0, "A setter drew before the next animation frame");
    await step();
    assert.equal(sentFrames().length, 1);
    assert.equal(sentFrames()[0].state.progress, .375, "The frame did not carry the latest pose");
    assert.equal(sentFrames()[0].state.pixelRatio, 2, "The scene must use every device pixel up to 2x");
    renderer.setProgress(.38);
    for (let i = 0; i < 12; i++) await step();
    const sent = sentFrames().sort((a, b) => a.id - b.id);
    assert.ok(sent.length >= 3, "Idle lanes were left waiting while the page scrolled");
    assert.deepEqual(sent.map(frame => frame.id), sent.map((_, index) => index), "Frame numbers must rise by one");
    assert.ok(sent.every((frame, index) => !index || frame.clock >= sent[index - 1].clock), "The shared clock ran backwards");
    assert.equal(new Set(workers.filter(worker => worker.sent.some(message => message.type === "frame"))).size, 3, "Frames did not spread across the lanes");
    const owner = id => workers.find(worker => worker.sent.some(message => message.type === "frame" && message.id === id));
    const drawn = () => calls.filter(call => call[0] === "drawImage").length;
    owner(1).finish(1);
    assert.equal(drawn(), 1);
    owner(0).finish(0);
    assert.equal(drawn(), 1, "A late frame replaced a newer one");
    owner(2).finish(2);
    assert.equal(drawn(), 2);
    // Every lane is free again; the exact frame goes out on the next tick.
    workers.forEach(worker => worker.sent.filter(message => message.type === "frame").forEach(message => worker.finish(message.id)));
    for (let i = 0; i < 6; i++) await step();
    workers.forEach(worker => worker.sent.filter(message => message.type === "frame").forEach(message => worker.finish(message.id)));
    renderer.drawAtProgress(.5, 3);
    await step();
    const exact = sentFrames().sort((a, b) => a.id - b.id).at(-1);
    assert.equal(exact.state.progress, .5);
    assert.equal(exact.clock, 3, "An exact frame was drawn at another time");
    renderer.destroy();
    assert.ok(workers.every(worker => worker.terminated), "A lane outlived the scene");
    const after = sentFrames().length;
    renderer.setProgress(.6); await step();
    assert.equal(sentFrames().length, after, "A destroyed runtime kept drawing");
  } finally {
    renderer?.destroy();
    names.forEach((name, i) => originals[i] ? Object.defineProperty(globalThis, name, originals[i]) : Reflect.deleteProperty(globalThis, name));
  }
});
