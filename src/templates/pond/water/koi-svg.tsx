// A koi drawn once, on the server, as SVG: the still scene before the live pond takes over (and without
// JavaScript), and the koi in the viewing bowls of the projects page. Colours are the page's custom properties, so
// the fish follows the day/night switch; a deeper fish keeps less of its colour and more of the water's.

import {
  WAVE,
  VIEW,
  back,
  barbels,
  body,
  depthKeep,
  eyes,
  fins,
  frame,
  markings,
  newFrame,
  paddle,
  patchEllipse,
  restSpine,
  ridge,
  shadowOffset,
  swimSpine,
  tail,
  tailSway,
  SvgPath,
  SEGMENTS,
  HALF,
  type Tone,
  type Variety,
} from "./koi";
import s from "./water.module.css";

const draw = (fn: (sink: SvgPath) => void) => {
  const sink = new SvgPath();
  fn(sink);
  return sink.toString();
};

/** a colour token at this depth */
const tone = (name: Tone | "eye", keep: number) =>
  keep >= 0.999 ? `var(--koi-${name})` : `color-mix(in srgb, var(--koi-${name}) ${Math.round(keep * 100)}%, var(--water))`;

export type KoiSvgProps = {
  seed: number;
  variety?: Variety;
  bend: number;
  phase: number;
  depth: number;
  /** heading in degrees: the shadow is cast in the page's frame, so it is turned back by this much */
  angle: number;
  /** unique on the page, for the clip path */
  id: string;
  shadow?: boolean;
  /** the shadow's offset is a distance on the page, the same for a small fish as for a large one */
  shadowScale?: number;
  className?: string;
};

export function KoiSvg({ seed, variety, bend, phase, depth, angle, id, shadow = true, shadowScale = 1, className }: KoiSvgProps) {
  const look = markings(seed, variety);
  const spine = swimSpine(restSpine(bend), phase, WAVE, 1, new Float64Array(SEGMENTS * 2));
  const f = frame(spine, 1, newFrame());
  const bodyD = draw((p) => body(f, p));
  const tailD = draw((p) => tail(f, tailSway(phase, WAVE), p));
  const finsD = draw((p) => fins(f, paddle(phase), p));
  const keep = depthKeep(depth);
  const [ox, oy] = shadowOffset(depth).map((v) => v * shadowScale);
  const a = (-angle * Math.PI) / 180;
  const sx = ox * Math.cos(a) - oy * Math.sin(a), sy = ox * Math.sin(a) + oy * Math.cos(a);
  const clip = `koi-${id}`;
  return (
    <svg className={className} viewBox={VIEW.join(" ")} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}>
          <path d={bodyD} />
        </clipPath>
      </defs>
      {shadow && (
        <g className={s.cast} transform={`translate(${sx.toFixed(2)} ${sy.toFixed(2)})`}>
          <path d={tailD} />
          <path d={bodyD} />
        </g>
      )}
      <path className={s.fin} d={finsD} style={{ fill: tone(look.fin, keep) }} />
      <path className={s.fin} d={tailD} style={{ fill: tone(look.fin, keep) }} />
      <path d={bodyD} style={{ fill: tone(look.base, keep) }} />
      <g clipPath={`url(#${clip})`}>
        {look.patches.map((patch, i) => {
          const [cx, cy, rx, ry, rot] = patchEllipse(f, patch);
          return (
            <ellipse
              key={i}
              cx={cx.toFixed(2)}
              cy={cy.toFixed(2)}
              rx={rx.toFixed(2)}
              ry={ry.toFixed(2)}
              transform={`rotate(${((rot * 180) / Math.PI).toFixed(1)} ${cx.toFixed(2)} ${cy.toFixed(2)})`}
              style={{ fill: tone(patch.tone, keep) }}
            />
          );
        })}
        <path
          className={s.sheen}
          d={draw((p) => back(f, p))}
          style={{ strokeWidth: HALF * 0.9, strokeOpacity: look.sheen * keep }}
        />
        <path className={s.edge} d={bodyD} style={{ strokeWidth: HALF * 0.34, strokeOpacity: 0.2 * keep }} />
      </g>
      <path className={s.ridge} d={draw((p) => ridge(f, p))} style={{ strokeOpacity: 0.22 * keep }} />
      <path className={s.barbel} d={draw((p) => barbels(f, p))} style={{ stroke: tone(look.base, keep) }} />
      {eyes(f).map(([cx, cy, r], i) => (
        <circle key={i} cx={cx.toFixed(2)} cy={cy.toFixed(2)} r={r.toFixed(2)} style={{ fill: tone("eye", keep) }} />
      ))}
    </svg>
  );
}
