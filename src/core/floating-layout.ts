export type FloatingRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type FloatingItem = FloatingRect & { priority?: number };

function overlaps(a: FloatingRect, b: FloatingRect, gap: number) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

/** Keep each CSS-defined anchor unless it conflicts. Higher priority keeps its place. */
export function layoutFloating(
  items: FloatingItem[],
  viewport: FloatingRect,
  gap = 10,
) {
  const placed: FloatingRect[] = [];
  const result = new Array<FloatingRect & { crowded: boolean }>(items.length);
  const clamp = (value: number, low: number, high: number) =>
    Math.max(low, Math.min(value, Math.max(low, high)));
  const order = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.index - b.index);
  for (const item of order) {
    const fitX = (x: number) =>
      clamp(x, viewport.x, viewport.x + viewport.width - item.width);
    const fitY = (y: number) =>
      clamp(y, viewport.y, viewport.y + viewport.height - item.height);
    const xs = new Set([
      fitX(item.x),
      viewport.x,
      fitX(viewport.x + viewport.width),
    ]);
    const ys = new Set([
      fitY(item.y),
      viewport.y,
      fitY(viewport.y + viewport.height),
    ]);
    for (const rect of placed) {
      xs.add(fitX(rect.x - item.width - gap));
      xs.add(fitX(rect.x + rect.width + gap));
      ys.add(fitY(rect.y - item.height - gap));
      ys.add(fitY(rect.y + rect.height + gap));
    }
    const candidates = [...xs]
      .flatMap((x) =>
        [...ys].map((y) => ({ x, y, width: item.width, height: item.height })),
      )
      .sort(
        (a, b) =>
          (a.x - item.x) ** 2 +
          (a.y - item.y) ** 2 -
          ((b.x - item.x) ** 2 + (b.y - item.y) ** 2),
      );
    const chosen = candidates.find(
      (candidate) => !placed.some((rect) => overlaps(candidate, rect, gap)),
    );
    const rect = chosen ?? candidates[0];
    result[item.index] = {
      ...rect,
      crowded:
        !chosen || item.width > viewport.width || item.height > viewport.height,
    };
    placed.push(rect);
  }
  return result;
}
