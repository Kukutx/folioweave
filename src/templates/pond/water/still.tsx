// The pond as it is when the page opens, rendered on the server: every koi and lily pad of the scene in its place,
// laid out by CSS for the size of the pond (water.module.css). It is what shows before the live pond starts, with
// reduced data or without JavaScript; the live pond reads its fish and pads from here, takes over on its first
// frame and hides it.

import type { CSSProperties } from "react";
import { hashSeed, ORDER, pad, shadowOffset, SvgPath, veins } from "./koi";
import { KoiSvg } from "./koi-svg";
import { SCENES, type SceneName } from "./scenes";
import s from "./water.module.css";

const pct = (n: number | undefined) => (n === undefined ? undefined : `${n}%`);

const PAD_R = 50;
const padShape = (notch: number) => {
  const shape = new SvgPath();
  pad(PAD_R, notch, shape);
  const lines = new SvgPath();
  veins(PAD_R, notch, lines);
  return { shape: shape.toString(), lines: lines.toString() };
};
/** the rim catching the light, on the side facing it (upper left) */
const rim = (() => {
  const a0 = (196 * Math.PI) / 180, a1 = (290 * Math.PI) / 180, r = PAD_R - 1.5;
  return `M${(Math.cos(a0) * r).toFixed(2)} ${(Math.sin(a0) * r).toFixed(2)}A${r} ${r} 0 0 1 ${(Math.cos(a1) * r).toFixed(2)} ${(Math.sin(a1) * r).toFixed(2)}`;
})();

/** The seed of the n-th koi of a scene: the n-th project's id when there is one, so a project's koi swims here too. */
export const koiSeed = (scene: SceneName, seeds: readonly string[], index: number) =>
  hashSeed(seeds[index] ?? `${scene}:${index}`);

export function Still({ scene, seeds, id }: { scene: SceneName; seeds: readonly string[]; id: string }) {
  const { koi, pads, moon } = SCENES[scene];
  // deeper fish first, so a fish nearer the surface passes over them
  const order = koi.map((placement, index) => ({ placement, index })).sort((a, b) => b.placement.depth - a.placement.depth);
  return (
    <div className={s.still} aria-hidden="true">
      <i className={s.unit} data-unit="" />
      {order.map(({ placement: k, index }) => (
        <i
          key={index}
          className={s.koi}
          data-koi={index}
          data-only={k.only}
          data-angle={k.angle}
          data-bend={k.bend}
          data-phase={k.phase}
          data-depth={k.depth}
          data-seed={koiSeed(scene, seeds, index)}
          data-variety={ORDER[index % ORDER.length]}
          style={
            {
              "--x": pct(k.x),
              "--y": pct(k.y),
              "--px": pct(k.px),
              "--py": pct(k.py),
              "--s": k.size,
              "--r": `${k.angle}deg`,
            } as CSSProperties
          }
        >
          <KoiSvg
            seed={koiSeed(scene, seeds, index)}
            variety={ORDER[index % ORDER.length]}
            bend={k.bend}
            phase={k.phase}
            depth={k.depth}
            angle={k.angle}
            shadowScale={1 / k.size}
            id={`${id}-${index}`}
          />
        </i>
      ))}
      <i
        className={s.moon}
        data-moon=""
        style={{ "--x": pct(moon.x), "--y": pct(moon.y), "--px": pct(moon.px), "--py": pct(moon.py) } as CSSProperties}
      />
      {pads.map((p, index) => {
        const { shape, lines } = padShape((p.notch * Math.PI) / 180);
        // the pads float on the surface: their shadow falls as far as a surfacing koi's, whatever their size
        const [ox, oy] = shadowOffset(0);
        const shadow = `translate(${(ox / p.size).toFixed(2)} ${(oy / p.size).toFixed(2)})`;
        return (
          <i
            key={index}
            className={s.pad}
            data-pad={index}
            data-only={p.only}
            data-notch={p.notch}
            style={
              { "--x": pct(p.x), "--y": pct(p.y), "--px": pct(p.px), "--py": pct(p.py), "--s": p.size } as CSSProperties
            }
          >
            <svg viewBox="-60 -60 120 120" focusable="false">
              <path className={s.padCast} d={shape} transform={shadow} />
              <path className={s.leaf} d={shape} />
              <path className={s.vein} d={lines} />
              <path className={s.rim} d={rim} />
            </svg>
          </i>
        );
      })}
    </div>
  );
}
