/** Where each item of the fan sits, relative to the centre of the launcher.
 *
 * Items lie on quarter-circle arcs that open toward the roomier side of the
 * viewport: horizontally away from the nearer edge, vertically toward the
 * larger gap. The inner ring fills first; a ring holds as many items as fit
 * at `spacing` along its arc, and further rings are `ringGap` wider. */
export type FanOptions = {
  /** Centre of the launcher in viewport pixels. */
  center: { x: number; y: number };
  viewport: { width: number; height: number };
  /** Diameter of one item. */
  item: number;
  /** Smallest distance between the centres of neighbouring items. */
  spacing: number;
  /** Radius of the first ring. */
  radius: number;
  ringGap: number;
};
export type FanPoint = { x: number; y: number; ring: number };
export type FanLayout = {
  horizontal: -1 | 1;
  vertical: -1 | 1;
  points: FanPoint[];
};

export function ringCapacity(radius: number, spacing: number) {
  return Math.max(1, Math.floor((radius * Math.PI) / 2 / spacing) + 1);
}

export function layoutFan(count: number, options: FanOptions): FanLayout {
  const { center, viewport, item, spacing, radius, ringGap } = options;
  const horizontal = center.x > viewport.width / 2 ? -1 : 1;
  const vertical = center.y > viewport.height / 2 ? -1 : 1;
  // Rings, inner first, until every item has a place.
  const rings: { radius: number; size: number }[] = [];
  for (let left = count, r = radius; left > 0; r += ringGap) {
    const size = Math.min(left, ringCapacity(r, spacing));
    rings.push({ radius: r, size });
    left -= size;
  }
  // A fan that would leave the viewport shrinks toward the launcher as a
  // whole, so rings stay apart and focus order still follows the drawing.
  const room = Math.max(
    item,
    Math.min(
      horizontal < 0 ? center.x : viewport.width - center.x,
      vertical < 0 ? center.y : viewport.height - center.y,
    ) -
      item / 2 -
      8,
  );
  const scale = Math.min(1, room / (rings.at(-1)?.radius ?? radius));
  const points: FanPoint[] = [];
  rings.forEach((ring, index) => {
    const r = ring.radius * scale;
    for (let i = 0; i < ring.size; i++) {
      // 0 points straight along the vertical, π/2 along the horizontal.
      const angle =
        ring.size === 1 ? Math.PI / 4 : (i / (ring.size - 1)) * (Math.PI / 2);
      points.push({
        // `+ 0` turns -0 into 0 for clean styles.
        x: Math.round(horizontal * Math.sin(angle) * r * 100) / 100 + 0,
        y: Math.round(vertical * Math.cos(angle) * r * 100) / 100 + 0,
        ring: index,
      });
    }
  });
  return { horizontal, vertical, points };
}
