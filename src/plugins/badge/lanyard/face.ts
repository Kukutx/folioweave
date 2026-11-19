/*
 * Card faces drawn from text: the reference's layout, a light or dark card
 * with a dashed grid behind a hexagonal roundel holding a logo, and under it
 * a title, a monospace kicker and a short description. Proportions are
 * measured on the reference with the card's width as the unit; colours are
 * set so the lit card shows the reference's (faces are not tone mapped and
 * the key light lifts them about 3%).
 *
 * Plain 2D canvas, no 3D: the small badge on the page draws with it too.
 */

export type FaceTheme = "light" | "dark";

export type CardFace = {
  theme: FaceTheme;
  logo?: HTMLImageElement | null;
  title?: string;
  kicker?: string;
  description?: string;
};

export const THEMES = {
  light: {
    card: "#ffffff",
    panel: "#f1f1f3",
    grid: "#cfcfd6",
    roundel: "#ffffff",
    roundelEdge: "rgba(16, 18, 27, 0.08)",
    title: "#111114",
    kicker: "#6f6f75",
    text: "#6a6a70",
  },
  dark: {
    card: "#141416",
    panel: "#18181b",
    grid: "#2f2f35",
    roundel: "#222226",
    roundelEdge: "rgba(255, 255, 255, 0.08)",
    title: "#f3f3f5",
    kicker: "#8d8d94",
    text: "#a2a2a9",
  },
} as const;

const LAYOUT = {
  /** Height of the grid panel, as a share of the card's height. */
  panel: 0.48,
  /** Grid cell, dash and gap, as shares of the card's width. */
  cell: 0.094,
  dash: 0.006,
  gap: 0.009,
  /** Roundel: centre as a share of the card's height, size of the width. */
  roundelY: 0.252,
  roundel: 0.34,
  logo: 0.74,
  /** Text block: left inset, and the baselines as shares of the height. */
  inset: 0.072,
  titleY: 0.585,
  title: 0.078,
  kickerY: 0.655,
  kicker: 0.048,
  textY: 0.735,
  text: 0.054,
  leading: 1.32,
};

const MONO = 'ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, Menlo, monospace';

/** The page's own type, so the cards match the site. */
export function siteFont() {
  if (typeof document === "undefined") return "system-ui, sans-serif";
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
}

function hexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  // A hexagon with rounded corners, pointing up and down.
  const r = size / 2;
  const corner = r * 0.2;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = Math.PI / 2 + (i * Math.PI) / 3;
    return [cx + r * Math.cos(angle), cy - r * Math.sin(angle)] as const;
  });
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % 6];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    const [x2, y2] = points[(i + 1) % 6];
    const [x3, y3] = points[(i + 2) % 6];
    ctx.arcTo(x2, y2, (x2 + x3) / 2, (y2 + y3) / 2, corner);
  }
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Paint the front of a card in the reference's layout. */
export function paintCardFace(
  canvas: HTMLCanvasElement,
  face: CardFace,
  font = siteFont(),
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const theme = THEMES[face.theme];
  ctx.save();
  ctx.fillStyle = theme.card;
  ctx.fillRect(0, 0, w, h);

  // The grid panel.
  const panel = h * LAYOUT.panel;
  ctx.fillStyle = theme.panel;
  ctx.fillRect(0, 0, w, panel);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, panel);
  ctx.clip();
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = Math.max(1, w * 0.0028);
  ctx.setLineDash([w * LAYOUT.dash, w * LAYOUT.gap]);
  const cell = w * LAYOUT.cell;
  const offset = (w / 2) % cell;
  for (let x = offset; x < w; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, panel);
    ctx.stroke();
  }
  for (let y = cell * 0.6; y < panel; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  // The roundel and its logo.
  const cx = w / 2;
  const cy = h * LAYOUT.roundelY;
  const size = w * LAYOUT.roundel;
  ctx.save();
  ctx.shadowColor = "rgba(16, 18, 27, 0.08)";
  ctx.shadowBlur = w * 0.03;
  ctx.shadowOffsetY = w * 0.006;
  hexagon(ctx, cx, cy, size);
  ctx.fillStyle = theme.roundel;
  ctx.fill();
  ctx.restore();
  hexagon(ctx, cx, cy, size);
  ctx.strokeStyle = theme.roundelEdge;
  ctx.lineWidth = Math.max(1, w * 0.002);
  ctx.setLineDash([]);
  ctx.stroke();
  if (face.logo) {
    const box = size * LAYOUT.logo;
    const scale = Math.min(box / face.logo.width, box / face.logo.height);
    const lw = face.logo.width * scale;
    const lh = face.logo.height * scale;
    ctx.drawImage(face.logo, cx - lw / 2, cy - lh / 2, lw, lh);
  }

  // The text.
  const left = w * LAYOUT.inset;
  const room = w - left * 2;
  ctx.textBaseline = "alphabetic";
  if (face.title) {
    ctx.fillStyle = theme.title;
    ctx.font = `600 ${w * LAYOUT.title}px ${font}`;
    ctx.fillText(face.title, left, h * LAYOUT.titleY, room);
  }
  if (face.kicker) {
    ctx.fillStyle = theme.kicker;
    ctx.font = `500 ${w * LAYOUT.kicker}px ${MONO}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${w * LAYOUT.kicker * 0.08}px`;
    ctx.fillText(face.kicker.toUpperCase(), left, h * LAYOUT.kickerY, room);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  }
  if (face.description) {
    ctx.fillStyle = theme.text;
    const size = w * LAYOUT.text;
    ctx.font = `400 ${size}px ${font}`;
    wrap(ctx, face.description, room)
      .slice(0, 4)
      .forEach((line, index) =>
        ctx.fillText(line, left, h * LAYOUT.textY + index * size * LAYOUT.leading, room),
      );
  }
  ctx.restore();
}

/** Paint the back of a card drawn from text: its colour with the logo. */
export function paintCardBack(canvas: HTMLCanvasElement, face: CardFace) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.fillStyle = THEMES[face.theme].card;
  ctx.fillRect(0, 0, w, h);
  if (!face.logo) return;
  const box = w * 0.32;
  const scale = Math.min(box / face.logo.width, box / face.logo.height);
  const lw = face.logo.width * scale;
  const lh = face.logo.height * scale;
  ctx.drawImage(face.logo, (w - lw) / 2, (h - lh) / 2, lw, lh);
}
