#!/usr/bin/env node
// Draws the four project figures of the Refract demo profile. They are original,
// deterministic drawings: run this again after changing a study and commit the
// SVG files it writes to governance/templates/assets.
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "governance/templates/assets");
const W = 1200,
  H = 800;
const ink = "#f6f4f2";
const n = (value) => Number(value.toFixed(1));

/** A small seeded generator keeps every run byte-identical. */
const random = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const frame = (accent, title, index, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<defs><radialGradient id="g" cx="50%" cy="46%" r="70%"><stop offset="0" stop-color="#34312f"/><stop offset="1" stop-color="#191817"/></radialGradient>` +
  `<radialGradient id="a" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${accent}" stop-opacity=".34"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>` +
  `<pattern id="d" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="${ink}" fill-opacity=".1"/></pattern></defs>` +
  `<rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#d)"/>` +
  body +
  `<g font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="15" fill="${ink}" fill-opacity=".62">` +
  `<text x="48" y="64">${index} / 04</text><text x="${W - 48}" y="64" text-anchor="end">${title}</text>` +
  `<text x="48" y="${H - 44}" fill-opacity=".4">ORIGINAL STUDY FOR THE REFRACT DEMO</text></g>` +
  `<path d="M48 84h${W - 96}M48 ${H - 80}h${W - 96}" stroke="${ink}" stroke-opacity=".14"/>` +
  `<rect x="48" y="56" width="0" height="0"/><circle cx="${W - 54}" cy="${H - 50}" r="5" fill="${accent}"/></svg>\n`;

// 01 — contour lines of an invented terrain, with a surveyed transect.
const fieldNotes = () => {
  const accent = "#ff4b4b";
  const peaks = [
    [420, 400, 190, 1],
    [760, 330, 150, 0.85],
    [690, 560, 120, 0.6],
  ];
  const height = (x, y) =>
    peaks.reduce(
      (sum, [px, py, spread, weight]) =>
        sum +
        weight * Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * spread ** 2)),
      0,
    );
  let body = `<ellipse cx="520" cy="410" rx="470" ry="330" fill="url(#a)"/>`;
  const step = 12;
  for (let level = 1; level <= 11; level++) {
    const threshold = level / 11.5;
    let segments = "";
    // Marching squares, traced as short strokes: enough for a figure.
    for (let y = 110; y < H - 100; y += step)
      for (let x = 60; x < W - 60; x += step) {
        const corners = [
          height(x, y),
          height(x + step, y),
          height(x + step, y + step),
          height(x, y + step),
        ];
        const points = [];
        const edge = (a, b, ax, ay, bx, by) => {
          if (a >= threshold === b >= threshold) return;
          const t = (threshold - a) / (b - a);
          points.push(`${n(ax + (bx - ax) * t)} ${n(ay + (by - ay) * t)}`);
        };
        edge(corners[0], corners[1], x, y, x + step, y);
        edge(corners[1], corners[2], x + step, y, x + step, y + step);
        edge(corners[2], corners[3], x + step, y + step, x, y + step);
        edge(corners[3], corners[0], x, y + step, x, y);
        if (points.length === 2) segments += `M${points[0]}L${points[1]}`;
      }
    const major = level % 4 === 0;
    body += `<path d="${segments}" fill="none" stroke="${major ? accent : ink}" stroke-opacity="${major ? 0.95 : 0.2 + level * 0.035}" stroke-width="${major ? 2.2 : 1.1}" stroke-linecap="round"/>`;
  }
  const transect = [
    [190, 610],
    [420, 400],
    [760, 330],
    [1010, 200],
  ];
  body += `<path d="M${transect.map((p) => p.join(" ")).join("L")}" fill="none" stroke="${ink}" stroke-opacity=".7" stroke-width="1.4" stroke-dasharray="3 9"/>`;
  transect.forEach(([x, y], i) => {
    body += `<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="${accent}" stroke-opacity=".5"/><circle cx="${x}" cy="${y}" r="5" fill="${i === 1 ? accent : ink}"/>`;
    body += `<text x="${x + 24}" y="${y - 14}" font-family="ui-monospace,Consolas,monospace" font-size="14" fill="${ink}" fill-opacity=".72">N${String(i + 1).padStart(2, "0")} · ${Math.round(height(x, y) * 820)} m</text>`;
  });
  return frame(accent, "FIELD NOTES", "01", body);
};

// 02 — one calm reading of several environmental layers.
const commonGround = () => {
  const accent = "#ffa828";
  const next = random(7);
  let body = `<ellipse cx="610" cy="430" rx="520" ry="300" fill="url(#a)"/>`;
  const left = 110,
    right = W - 110,
    base = 640;
  for (let i = 0; i <= 12; i++) {
    const x = left + ((right - left) * i) / 12;
    body += `<path d="M${n(x)} 140V${base}" stroke="${ink}" stroke-opacity="${i % 3 ? 0.07 : 0.16}"/>`;
    if (i % 3 === 0)
      body += `<text x="${n(x)}" y="${base + 30}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="${ink}" fill-opacity=".5">${String(2014 + i).padStart(4, "0")}</text>`;
  }
  const layers = [
    { color: ink, opacity: 0.1, lift: 70, swing: 46 },
    { color: "#05dbe9", opacity: 0.16, lift: 150, swing: 62 },
    { color: accent, opacity: 0.3, lift: 250, swing: 84 },
  ];
  layers.forEach(({ color, opacity, lift, swing }, layer) => {
    const points = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const y =
        base -
        lift -
        Math.sin(t * Math.PI * (1.6 + layer * 0.7) + layer) * swing -
        t * 90 -
        next() * 16;
      points.push(`${n(left + (right - left) * t)} ${n(y)}`);
    }
    body += `<path d="M${left} ${base}L${points.join("L")}L${right} ${base}Z" fill="${color}" fill-opacity="${opacity}"/>`;
    body += `<path d="M${points.join("L")}" fill="none" stroke="${color}" stroke-width="${layer === 2 ? 3 : 1.6}" stroke-opacity="${layer === 2 ? 1 : 0.7}" stroke-linejoin="round"/>`;
    if (layer === 2) {
      const [x, y] = points[36].split(" ").map(Number);
      body += `<path d="M${x} ${y}V${base}" stroke="${accent}" stroke-dasharray="2 7"/><circle cx="${x}" cy="${y}" r="20" fill="none" stroke="${accent}" stroke-opacity=".45"/><circle cx="${x}" cy="${y}" r="7" fill="${accent}"/>`;
      body += `<g font-family="ui-monospace,Consolas,monospace" fill="${ink}"><text x="${x + 34}" y="${y - 6}" font-size="30" font-weight="700">+18.4%</text><text x="${x + 34}" y="${y + 18}" font-size="13" fill-opacity=".6">CANOPY COVER, 9-YEAR MEAN</text></g>`;
    }
  });
  for (let i = 0; i < 26; i++) {
    const x = left + ((right - left) * i) / 25;
    const tall = 10 + next() * 54;
    body += `<path d="M${n(x)} ${base - 2}v-${n(tall)}" stroke="${ink}" stroke-opacity=".38" stroke-width="5"/>`;
  }
  body += `<path d="M${left} ${base}H${right}" stroke="${ink}" stroke-opacity=".5"/>`;
  return frame(accent, "COMMON GROUND", "02", body);
};

// 03 — a constellation of connected ideas around a few anchors.
const openAtlas = () => {
  const accent = "#00ffaa";
  const next = random(23);
  let body = `<circle cx="600" cy="410" r="330" fill="url(#a)"/>`;
  for (const r of [110, 190, 270, 350])
    body += `<circle cx="600" cy="410" r="${r}" fill="none" stroke="${ink}" stroke-opacity="${r === 270 ? 0.3 : 0.12}" stroke-dasharray="${r === 270 ? "none" : "2 8"}"/>`;
  const nodes = [{ x: 600, y: 410, r: 15, hub: true }];
  [110, 190, 270, 350].forEach((radius, ring) => {
    const count = 5 + ring * 4;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + ring * 0.5 + next() * 0.3;
      nodes.push({
        x: 600 + Math.cos(angle) * radius,
        y: 410 + Math.sin(angle) * radius * 0.88,
        r: ring === 0 ? 8 : 3 + next() * 4,
        hub: ring === 0 || next() > 0.86,
        ring,
      });
    }
  });
  let links = "",
    strong = "";
  nodes.forEach((node, i) => {
    if (!i) return;
    const candidates = nodes
      .slice(0, i)
      .filter((other) => (other.ring ?? -1) < node.ring)
      .sort(
        (a, b) =>
          Math.hypot(a.x - node.x, a.y - node.y) -
          Math.hypot(b.x - node.x, b.y - node.y),
      );
    const target = candidates[0] ?? nodes[0];
    const curve = `M${n(node.x)} ${n(node.y)}Q${n((node.x + target.x) / 2 + (next() - 0.5) * 60)} ${n((node.y + target.y) / 2 + (next() - 0.5) * 60)} ${n(target.x)} ${n(target.y)}`;
    if (node.hub && target.hub) strong += curve;
    else links += curve;
  });
  body += `<path d="${links}" fill="none" stroke="${ink}" stroke-opacity=".22" stroke-width="1.1"/>`;
  body += `<path d="${strong}" fill="none" stroke="${accent}" stroke-opacity=".9" stroke-width="2"/>`;
  for (const node of nodes) {
    if (node.hub)
      body += `<circle cx="${n(node.x)}" cy="${n(node.y)}" r="${n(node.r + 9)}" fill="none" stroke="${accent}" stroke-opacity=".4"/>`;
    body += `<circle cx="${n(node.x)}" cy="${n(node.y)}" r="${n(node.r)}" fill="${node.hub ? accent : ink}" fill-opacity="${node.hub ? 1 : 0.7}"/>`;
  }
  body += `<g font-family="ui-monospace,Consolas,monospace" font-size="14" fill="${ink}" fill-opacity=".72"><text x="630" y="392">ORIGIN</text><text x="884" y="250">${nodes.length} NODES · ${nodes.length - 1} LINKS</text><path d="M876 256H820l-34 34" fill="none" stroke="${ink}" stroke-opacity=".5"/></g>`;
  return frame(accent, "OPEN ATLAS", "03", body);
};

// 04 — light meeting a faceted solid, and leaving it as colour.
const materialStudies = () => {
  const accent = "#05dbe9";
  const next = random(41);
  let body = `<ellipse cx="560" cy="420" rx="430" ry="320" fill="url(#a)"/>`;
  const centre = [560, 420];
  const rim = [];
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 - 0.4;
    const radius = 215 + next() * 55;
    rim.push([
      centre[0] + Math.cos(angle) * radius,
      centre[1] + Math.sin(angle) * radius * 0.92,
    ]);
  }
  const inner = rim.map(([x, y], i) => {
    const [bx, by] = rim[(i + 1) % rim.length];
    return [
      centre[0] + ((x + bx) / 2 - centre[0]) * 0.46,
      centre[1] + ((y + by) / 2 - centre[1]) * 0.46,
    ];
  });
  const facet = (points, shade) =>
    `<path d="M${points.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z" fill="${ink}" fill-opacity="${shade}" stroke="${ink}" stroke-opacity=".5" stroke-width="1.1" stroke-linejoin="round"/>`;
  rim.forEach((point, i) => {
    const after = rim[(i + 1) % rim.length];
    const light = 0.5 + 0.5 * Math.cos((i / rim.length) * Math.PI * 2 + 2.3);
    body += facet([point, after, inner[i]], 0.03 + light * 0.2);
    body += facet(
      [point, inner[i], inner[(i + rim.length - 1) % rim.length]],
      0.02 + (1 - light) * 0.12,
    );
  });
  body += facet(inner, 0.2);
  body += `<path d="M${inner.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z" fill="none" stroke="${accent}" stroke-width="2"/>`;
  // One ray in; the palette of the rim out.
  body += `<path d="M60 250L${n(inner[5][0])} ${n(inner[5][1])}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  const spectrum = [
    "#ff4b4b",
    "#ffa828",
    "#ffcc2a",
    "#00ffaa",
    "#05dbe9",
    "#4d9cff",
  ];
  spectrum.forEach((color, i) => {
    const y = 430 + (i - 2.5) * 62;
    body += `<path d="M${n(inner[1][0])} ${n(inner[1][1])}L${W - 60} ${n(y)}" stroke="${color}" stroke-width="${i === 4 ? 4 : 2.4}" stroke-linecap="round" stroke-opacity="${i === 4 ? 1 : 0.85}"/>`;
  });
  body += `<g font-family="ui-monospace,Consolas,monospace" font-size="14" fill="${ink}" fill-opacity=".72"><text x="76" y="232">INCIDENT 34°</text><text x="${W - 60}" y="232" text-anchor="end">DISPERSION 6 BANDS</text></g>`;
  return frame(accent, "MATERIAL STUDIES", "04", body);
};

const figures = {
  "field-notes.svg": fieldNotes(),
  "common-ground.svg": commonGround(),
  "open-atlas.svg": openAtlas(),
  "material-studies.svg": materialStudies(),
};
for (const [name, svg] of Object.entries(figures)) {
  await fs.writeFile(path.join(out, name), svg);
  console.log(`${name}  ${(svg.length / 1024).toFixed(1)} KiB`);
}
