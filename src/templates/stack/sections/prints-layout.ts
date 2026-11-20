// Where each print lies on the table, worked out once on the server so the page renders in
// place without measuring anything. All lengths are in hundredths of the table's width
// (cqw), so the same numbers hold at every size; a narrow table gets its own set.

export type Place = { x: number; y: number; w: number; h: number; r: number };
export type TableLayout = {
  /** the pile: a loose scatter, the first print on top */
  pile: Place[];
  pileHeight: number;
  /** the contact sheet: a grid of equal frames */
  grid: { x: number; y: number }[];
  cell: { w: number; h: number };
  gridHeight: number;
};

/** A small seeded generator (mulberry32): the same pile on every build. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

function layout(
  ratios: readonly number[],
  {
    height,
    portrait,
    landscape,
    spacing,
    columns,
    gap,
  }: {
    height: number;
    portrait: number;
    landscape: number;
    spacing: number;
    columns: number;
    gap: number;
  },
): TableLayout {
  const next = random(0x5eed + ratios.length * 97);
  const centres: { x: number; y: number }[] = [];
  const pile = ratios.map((ratio, i) => {
    let w = ratio < 1 ? portrait : landscape;
    let h = w / ratio;
    const tallest = height * 0.82;
    if (h > tallest) {
      h = tallest;
      w = h * ratio;
    }
    // the first print near the middle, the rest scattered around it, kept apart
    let best = { x: 50, y: height / 2 };
    // room for a turned print's corners inside the table
    const margin = 2 + w * 0.06;
    let bestGap = -1;
    for (let attempt = 0; attempt < (i === 0 ? 1 : 48); attempt++) {
      const candidate =
        i === 0
          ? { x: 46 + next() * 8, y: height * (0.45 + next() * 0.1) }
          : {
              x: w / 2 + margin + next() * (100 - w - margin * 2),
              y: h / 2 + 1 + next() * (height - h - 2),
            };
      const nearest = Math.min(
        Infinity,
        ...centres.map((c) => Math.hypot(c.x - candidate.x, c.y - candidate.y)),
      );
      if (nearest >= spacing) {
        best = candidate;
        break;
      }
      if (nearest > bestGap) {
        bestGap = nearest;
        best = candidate;
      }
    }
    centres.push(best);
    const r = i === 0 ? -2 + next() * 4 : (next() * 2 - 1) * 11;
    return {
      x: round(best.x - w / 2),
      y: round(best.y - h / 2),
      w: round(w),
      h: round(h),
      r: round(r),
    };
  });
  const cellW = (100 - gap * (columns - 1)) / columns;
  const cellH = cellW * 1.25;
  const rows = Math.ceil(ratios.length / columns);
  return {
    pile,
    pileHeight: height,
    grid: ratios.map((_, i) => ({
      x: round((i % columns) * (cellW + gap)),
      y: round(Math.floor(i / columns) * (cellH + gap)),
    })),
    cell: { w: round(cellW), h: round(cellH) },
    gridHeight: round(rows * cellH + (rows - 1) * gap),
  };
}

export function tableLayouts(ratios: readonly number[]) {
  return {
    large: layout(ratios, {
      height: 62,
      portrait: 25,
      landscape: 36,
      spacing: 17,
      columns: 3,
      gap: 2.4,
    }),
    small: layout(ratios, {
      height: 132,
      portrait: 46,
      landscape: 64,
      spacing: 26,
      columns: 2,
      gap: 3.2,
    }),
  };
}
