import {
  TAU,
  clamp,
  mix,
  smooth,
  noise,
  spherePoint,
  normalized,
  rotation,
  axialRotation,
  rotate,
  toolsSpinOpening,
  createGlassShell,
  createGraticule,
  type Vec3,
  type GeoVertex,
  type GlassFace,
  type Rotation,
} from "./earth-geometry";
import {
  sceneAccent,
  sceneBackground,
  sceneDrawing,
  sceneGlass,
  sceneInk,
  sceneLight,
  type StylePreset,
} from "./scene-theme";
import {
  assemblyGlint,
  continentalChapter,
  continentalPhase,
  continentalYaw,
  heroSpin,
  createContinentalPlayback,
  researchBlend,
  sceneExit,
  sceneLayout,
  toolsCopyOpacity,
  toolsOpening,
  toolsTurn,
  type ContinentalDriftOptions,
} from "./scene-progress";
import { createResearchLayers, type LayerFrame } from "./research-layers";
import {
  createGlassShards,
  glassShardPose,
  glassSpinEnvelope,
  transformShardPoint,
  type GlassShard,
} from "./glass-fracture";
import { createContinentalRenderer } from "./continental-drift";
import {
  sceneCamera,
  scenePerspective,
  sceneSphereScale,
  fitBesideReading,
  projectedHull,
  type ReadingBounds,
} from "./scene-camera";

export type EarthRendererOptions = {
  /** Longitude / latitude degrees; imported JSON arrays are accepted directly. */
  landPoints?: ReadonlyArray<ReadonlyArray<number>>;
  reducedMotion?: boolean;
  width?: number;
  height?: number;
  /** Worker surfaces have no window.devicePixelRatio. */
  pixelRatio?: number;
  autoStart?: boolean;
  location?: { label: string; latitude: number; longitude: number };
  style?: StylePreset;
  projectCount?: number;
  /** Parent-owned refresh sequence; independent of the scroll narrative. */
  introProgress?: number;
  /** Restore the early mirror fragments in Tools; shared by both style presets. */
  fracturedGlass?: boolean;
  /** A project-owned scroll interval; absent means the original globe throughout. */
  continentalDrift?: ContinentalDriftOptions | false;
  /** Up to four captions for the drawing stage's sheets; none draws no leaders. */
  layerLabels?: readonly string[];
  toolsBounds?: ReadingBounds | null;
};
export type EarthRenderer = {
  setIntroProgress(progress: number): void;
  setMobileLayout(layout: { centerY: number; radius: number } | null): void;
  setToolsBounds(bounds: ReadingBounds | null): void;
  setProgress(progress: number): void;
  /** Extra yaw from the reader turning the opening globe by hand, in radians. */
  setSpin(yaw: number): void;
  setPaused(paused: boolean): void;
  /** Keep the latest pose without drawing while the parent hides the stage. */
  setSuspended(suspended: boolean): void;
  setReducedMotion(reduced: boolean): void;
  /** Snapshots use time as elapsed effect time; live frames use the chapter-entry clock. */
  drawAtProgress(
    progress: number,
    timeSeconds?: number,
    mode?: "snapshot" | "live",
  ): void;
  resize(): void;
  destroy(clearCanvas?: boolean): void;
};
type ScreenPoint = { x: number; y: number; z: number; perspective: number };
type ProjectedFace = {
  points: [ScreenPoint, ScreenPoint, ScreenPoint];
  depth: number;
  normal: Vec3;
  seed: number;
  dots?: ScreenPoint[];
};
type RingVertex = { point: ScreenPoint; depth: number };
type Frame = {
  p: number;
  dark: number;
  ink: number;
  cx: number;
  cy: number;
  radius: number;
  distance: number;
  split: number;
  stack: number;
  research: number;
  internalAlpha: number;
  exit: number;
  opacity: number;
  glint: number;
  turn: number;
  rotation: Rotation;
  globeRotation: Rotation;
  layerRotation: Rotation;
  coreAlpha: number;
  drawing: ReturnType<typeof sceneDrawing>;
  continental: number;
  continentalVisibility: number;
};
const gray = (value: number, alpha = 1) => {
  const v = Math.round(clamp(value, 0, 255));
  return "rgba(" + v + "," + v + "," + v + "," + clamp(alpha) + ")";
};
const INERT_RENDERER: EarthRenderer = {
  setIntroProgress() {},
  setMobileLayout() {},
  setToolsBounds() {},
  setProgress() {},
  setSpin() {},
  setPaused() {},
  setSuspended() {},
  setReducedMotion() {},
  drawAtProgress() {},
  resize() {},
  destroy() {},
};
const LIGHT = normalized({ x: -0.5, y: 0.75, z: 0.9 });
const layerOf = (z: number) =>
  Math.min(3, Math.max(0, Math.floor((z + 1) * 2)));

/**
 * One viewport-centred 3D stage, projected into Canvas2D without WebGL.
 * Front / axial disassembly / front / second disassembly follows the reference.
 * The parent owns narrative copy and background; technical labels share the projection.
 */
export function createEarthRenderer(
  canvas: HTMLCanvasElement,
  options: EarthRendererOptions = {},
): EarthRenderer {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return INERT_RENDERER;
  const ctx = context;
  const stylePreset = options.style ?? "dark";
  let reducedMotion = !!options.reducedMotion;
  const browser =
    typeof window !== "undefined" && typeof document !== "undefined";
  const autoStart = options.autoStart !== false && browser;
  let width = 1,
    height = 1,
    dpr = 1,
    mobile = false;
  let progress = 0,
    clock = 0,
    spin = 0;
  let snapshot = false;
  const continentalPlayback = createContinentalPlayback(
    options.continentalDrift,
  );
  let introProgress = options.introProgress ?? 1;
  let mobileLayout: { centerY: number; radius: number } | null = null;
  let toolsBounds = options.toolsBounds ?? null;
  let paused = false,
    suspended = false,
    destroyed = false,
    visible = true;
  let raf = 0,
    lastTime = 0;
  let shell: GlassFace[] = [],
    graticule: GeoVertex[][] = [],
    land: GeoVertex[] = [];
  let projectedFaces: ProjectedFace[] = [];
  let shards: GlassShard[] | null = null;
  let continents: ReturnType<typeof createContinentalRenderer> | null = null;
  let faceGeometryKey = "";
  let faceScale = 1;
  let fitGeometryKey = "",
    fittedScale = 1;
  let spinEnvelope: ReturnType<typeof glassSpinEnvelope> = [],
    envelopeSplit = -1;
  let ringLines: RingVertex[][] = [];
  let ringTicks: { a: ScreenPoint; b: ScreenPoint; depth: number }[] = [];
  let ringGeometryKey = "";
  let wireGeometryKey = "";
  let wireGeometry: { layer: number; points: Vec3[]; lineWidth: number }[] = [];
  let wireLines: { points: ScreenPoint[]; lineWidth: number }[] = [];
  const sourceLand = (options.landPoints || []).filter(
    (point) =>
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  );
  const location = options.location;
  const locationPoint = location
    ? spherePoint(
        (location.longitude * Math.PI) / 180,
        (location.latitude * Math.PI) / 180,
        1.006,
      )
    : null;
  const initialLongitude = location
    ? (-location.longitude * Math.PI) / 180 + 0.18
    : -0.42;
  const researchLayers = createResearchLayers();
  const fractureEnabled = options.fracturedGlass !== false;
  const fractureAmount = (frame: Frame) =>
    fractureEnabled ? smooth(0, 0.7, frame.split) : 0;

  const frameState = (): Frame => {
    const p = progress;
    const stack = reducedMotion
      ? Number(p >= 0.15 && p < 0.4)
      : smooth(0.12, 0.27, p) * (1 - smooth(0.32, 0.42, p));
    const split = reducedMotion ? 0 : toolsOpening(p);
    const turn = reducedMotion ? 0 : toolsTurn(p) * TAU;
    const research = smooth(0.4, 0.445, p) * (1 - smooth(0.81, 0.835, p));
    const dark = 1 - sceneLight(p, stylePreset);
    const camera = sceneCamera(p, reducedMotion, mobile);
    const originalRadius = mobile
      ? Math.min(width * 0.355, height * 0.275)
      : Math.min(width * 0.28, height * 0.31, 306);
    // Match the reference's bounded visual size while keeping its viewport center.
    const toolsScale = reducedMotion
      ? 0
      : smooth(0.82, 0.855, p) * (1 - smooth(0.98, 1, p));
    const baseRadius = mobile
      ? (mobileLayout?.radius ?? originalRadius)
      : mix(originalRadius, Math.min(width * 0.28, height * 0.335), toolsScale);
    // Keep the established open terrain composition as the globe grows; both
    // endpoints still interpolate through the same reversible assembly pose.
    const stackScale = mobile
      ? width >= 600 && height < 600
        ? 0.55
        : 0.65
      : Math.min(
          Math.min(width * 0.28, height * 0.28, 274) * 0.72,
          width * 0.132,
        ) / baseRadius;
    const continental = snapshot
      ? continentalPhase(p, options.continentalDrift, reducedMotion, clock)
      : continentalPlayback.sample(p, clock, reducedMotion);
    const chapter = continentalChapter(p, options.continentalDrift);
    const range = options.continentalDrift
      ? options.continentalDrift.ranges[chapter]
      : undefined;
    const local = range ? (p - range[0]) / (range[1] - range[0]) : 1;
    const continentalVisibility = 1 - smooth(0.75, 1, local);
    const assemblyScale = 1 - stack * (1 - stackScale);
    // A hand-turned globe belongs to the opening only: the offset is gone
    // before the first transformation, so every later pose stays repeatable.
    const globeYaw =
      initialLongitude +
      (reducedMotion ? 0 : clock * 0.12 + spin * heroSpin(p));
    // Turn the land-rich hemisphere into view during playback, then return to
    // the same uninterrupted globe rotation. Derive the turn from entry time
    // so crossing +/- PI cannot flip the chosen direction between frames.
    const elapsed =
      Math.max(0, continental) *
      (options.continentalDrift ? (options.continentalDrift.duration ?? 8) : 8);
    const entryYaw = globeYaw - elapsed * 0.12;
    const focus = continentalYaw(chapter);
    const landTurn = Math.atan2(
      Math.sin(focus - entryYaw),
      Math.cos(focus - entryYaw),
    );
    const landFocus =
      continental < 0
        ? 0
        : smooth(0, 0.22, continental) *
          (1 - smooth(0.72, 1, continental)) *
          continentalVisibility;
    return {
      p,
      dark,
      drawing: sceneDrawing(p, stylePreset, dark, options.projectCount),
      ink: sceneInk(dark),
      cx: width * 0.5,
      cy: mobile ? (mobileLayout?.centerY ?? height * 0.5) : height * 0.5,
      radius: baseRadius * assemblyScale,
      distance: camera.distance,
      split,
      stack,
      research,
      internalAlpha: 1,
      exit: reducedMotion ? 0 : sceneExit(p),
      glint: reducedMotion ? 0 : assemblyGlint(p),
      turn,
      opacity: reducedMotion ? 1 - smooth(0.965, 1, p) : 1,
      rotation: rotation(camera.yaw, camera.pitch, camera.roll),
      layerRotation: rotation(camera.layerYaw, camera.layerPitch),
      globeRotation: axialRotation(
        (globeYaw + landTurn * landFocus) * (1 - stack) + turn,
        toolsSpinOpening(split),
        0.1 * (1 - Math.max(split, stack)),
        -0.14 * (1 - Math.max(split, stack)),
      ),
      coreAlpha: 1 - smooth(0.025, 0.8, split),
      continental,
      continentalVisibility,
    };
  };
  const project = (point: Vec3, frame: Frame): ScreenPoint => {
    const perspective = scenePerspective(point.z, frame.distance);
    return {
      x: frame.cx + point.x * frame.radius * perspective,
      y: frame.cy - (point.y + frame.exit * 6) * frame.radius * perspective,
      z: point.z,
      perspective,
    };
  };
  const scenePoint = (point: Vec3, frame: Frame) =>
    rotate(point, frame.rotation);
  const earthPoint = (vertex: Vec3, frame: Frame) => {
    const point = rotate(vertex, frame.globeRotation);
    return scenePoint(
      {
        x: point.x * (1 + frame.split * 0.1),
        y: point.y * (1 + frame.split * 0.1),
        z: point.z + (layerOf(vertex.z) - 1.5) * frame.split * 0.96,
      },
      frame,
    );
  };
  const path = (points: ScreenPoint[]) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  const layerFrame = (frame: Frame): LayerFrame => ({
    amount: frame.stack,
    clock,
    mobile,
    dark: frame.dark,
    poseKey: frame.p,
    plane: (point) => rotate(point, frame.layerRotation),
    project: (point) => project(point, frame),
    globe: (point) => scenePoint(rotate(point, frame.globeRotation), frame),
  });
  const strokePartial = (
    points: { x: number; y: number }[],
    amount: number,
  ) => {
    const lengths = points
      .slice(1)
      .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    let remaining = lengths.reduce((sum, n) => sum + n, 0) * clamp(amount);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < lengths.length && remaining > 0; i++) {
      const t = Math.min(1, remaining / Math.max(0.001, lengths[i]));
      ctx.lineTo(
        mix(points[i].x, points[i + 1].x, t),
        mix(points[i].y, points[i + 1].y, t),
      );
      remaining -= lengths[i];
    }
    ctx.stroke();
  };

  const buildFaces = (frame: Frame) => {
    const fracture = fractureAmount(frame);
    const { cy, sy, cp, sp, cr, sr, preCp, preSp } = frame.globeRotation;
    const key = `${mobile}/${reducedMotion}/${frame.p}/${frame.distance}/${frame.radius}/${frame.cx}/${frame.cy}/${cy}/${sy}/${cp}/${sp}/${cr}/${sr}/${preCp}/${preSp}`;
    if (key === faceGeometryKey) {
      frame.radius *= faceScale;
      return;
    }
    faceGeometryKey = key;
    faceScale = 1;
    projectedFaces = [];
    if (fracture > 0) {
      shards ??= createGlassShards(shell, land);
      for (const shard of shards) {
        const pose = glassShardPose(
          shard,
          frame.split,
          frame.globeRotation,
          frame.rotation,
          (shard.face.band - 1.5) * frame.split * 0.96,
        );
        const projectShard = (point: Vec3) =>
          project(transformShardPoint(point, pose), frame);
        const points = shard.vertices.map(projectShard) as [
          ScreenPoint,
          ScreenPoint,
          ScreenPoint,
        ];
        projectedFaces.push({
          points,
          depth: (points[0].z + points[1].z + points[2].z) / 3,
          normal: pose.normal,
          seed: shard.face.seed,
          dots: shard.dots.map(projectShard),
        });
      }
      projectedFaces.sort((a, b) => a.depth - b.depth);
      const fitKey = `${mobile}/${reducedMotion}/${frame.p}/${frame.distance}/${frame.radius}/${frame.cx}/${frame.cy}`;
      if (fitKey !== fitGeometryKey) {
        fitGeometryKey = fitKey;
        if (envelopeSplit !== frame.split) {
          spinEnvelope = glassSpinEnvelope(shards, frame.split);
          envelopeSplit = frame.split;
        }
        const post = rotation(
          0,
          (toolsSpinOpening(frame.split) * Math.PI) / 2 +
            0.1 * (1 - frame.split),
          -0.14 * (1 - frame.split),
        );
        const fitFaces = spinEnvelope.map((face) => ({
          points: projectedHull(
            face.points.map((point) => {
              const p = rotate(point, post);
              p.z += (face.band - 1.5) * frame.split * 0.96;
              return project(scenePoint(p, frame), frame);
            }),
          ),
        }));
        // Fit the complete local spin, so the rings do not breathe in size when
        // a rotating triangle becomes the new leftmost or topmost fragment.
        let left = 1,
          right = 1,
          vertical = 1;
        for (const face of fitFaces)
          for (const point of face.points) {
            left = Math.max(left, frame.cx - point.x);
            right = Math.max(right, point.x - frame.cx);
            vertical = Math.max(vertical, Math.abs(point.y - frame.cy));
          }
        const availableY = Math.min(
          frame.cy - 24,
          height - frame.cy - (mobile ? 84 : 24),
        );
        let fit = Math.min(
          1,
          (frame.cx - 16) / left,
          (width - frame.cx - 16) / right,
          availableY / vertical,
        );
        if (width >= sceneLayout.desktop) {
          const gutter = Math.max(64, (width - 1500) / 2 + 64);
          const bounds = toolsBounds ?? {
            left: gutter,
            right: gutter + 336,
            top: 64,
            bottom: 520,
          };
          fit = fitBesideReading(fitFaces, frame.cx, frame.cy, fit, bounds);
        }
        const fitWeight =
          width >= sceneLayout.desktop ? toolsCopyOpacity(frame.p) : 1;
        fittedScale = mix(1, Math.max(0.2, fit), fitWeight);
      }
      faceScale = fittedScale;
      if (faceScale < 1) {
        frame.radius *= faceScale;
        const fitPoint = (point: ScreenPoint) => {
          point.x = frame.cx + (point.x - frame.cx) * faceScale;
          point.y = frame.cy + (point.y - frame.cy) * faceScale;
        };
        for (const face of projectedFaces) {
          face.points.forEach(fitPoint);
          face.dots?.forEach(fitPoint);
        }
      }
      return;
    }
    if ((1 - frame.split) ** 2 < 0.002) return;
    // Closed-shell vertices are shared by adjacent triangles.
    const closedVertices =
      frame.split === 0 ? new Map<GeoVertex, ScreenPoint>() : null;
    for (const face of shell) {
      const spread = frame.split;
      const localRotation = rotation(0, 0);
      const centre = rotate(face.center, frame.globeRotation);
      const normal = rotate(face.normal, frame.globeRotation);
      const points = face.points.map((vertex) => {
        if (closedVertices) {
          let point = closedVertices.get(vertex);
          if (!point) {
            point = project(
              scenePoint(rotate(vertex, frame.globeRotation), frame),
              frame,
            );
            closedVertices.set(vertex, point);
          }
          return point;
        }
        const relative = rotate(
          rotate(
            {
              x: vertex.x - face.center.x,
              y: vertex.y - face.center.y,
              z: vertex.z - face.center.z,
            },
            frame.globeRotation,
          ),
          localRotation,
        );
        return project(
          scenePoint(
            {
              x: centre.x + relative.x,
              y: centre.y + relative.y,
              z: centre.z + relative.z + (face.band - 1.5) * spread * 0.96,
            },
            frame,
          ),
          frame,
        );
      }) as [ScreenPoint, ScreenPoint, ScreenPoint];
      projectedFaces.push({
        points,
        depth: (points[0].z + points[1].z + points[2].z) / 3,
        normal: scenePoint(rotate(normal, localRotation), frame),
        seed: face.seed,
      });
    }
    projectedFaces.sort((a, b) => a.depth - b.depth);
  };
  const drawFaces = (frame: Frame, front: boolean) => {
    if (ctx.globalAlpha < 0.002) return;
    const fracture = fractureAmount(frame);
    const stageAlpha =
      mix(0.28, 1, frame.internalAlpha) *
      mix((1 - frame.split) ** 2, 1, fracture);
    if (stageAlpha < 0.002) return;
    const glass = sceneGlass(frame.dark);
    // A slow light sweep reveals the individual planes without moving their map.
    const light = fracture
      ? normalized({
          x: LIGHT.x + Math.sin(clock * 0.24) * 0.16,
          y: LIGHT.y,
          z: LIGHT.z,
        })
      : LIGHT;
    // One shared softbox reflection crosses the tilted glass planes. Each face
    // responds to its normal; the band does not paint opaque white triangles.
    const reflection =
      fracture && front
        ? ctx.createLinearGradient(
            frame.cx - frame.radius * 0.75,
            frame.cy + frame.radius * 0.28,
            frame.cx + frame.radius * 0.7,
            frame.cy - frame.radius * 0.28,
          )
        : null;
    if (reflection) {
      reflection.addColorStop(0, gray(glass.glint, 0));
      reflection.addColorStop(0.28, gray(glass.glint, 0.03));
      reflection.addColorStop(0.43, gray(glass.glint, 0.9));
      reflection.addColorStop(0.49, gray(glass.glint, 0.06));
      reflection.addColorStop(0.7, gray(glass.glint, 0));
      reflection.addColorStop(1, gray(glass.glint, 0));
    }
    for (const face of projectedFaces) {
      if (face.depth >= 0 !== front) continue;
      const facing = face.normal.z,
        back = facing < 0 ? 0.22 : 1;
      const fresnel = Math.pow(1 - Math.abs(facing), 3);
      const highlight = Math.pow(
        Math.max(
          0,
          face.normal.x * light.x +
            face.normal.y * light.y +
            face.normal.z * light.z,
        ),
        17,
      );
      path(face.points);
      const fill = mix(
        mix(
          0.012 + fresnel * 0.028 + highlight * 0.05,
          0.025 + fresnel * 0.065 + highlight * 0.19,
          frame.glint,
        ) *
          (1 - frame.split * 0.8),
        0.018 + fresnel * 0.08 + highlight * 0.12 + face.seed * 0.025,
        fracture,
      );
      ctx.fillStyle = gray(
        mix(
          mix(mix(70, 80, frame.dark), glass.fill, frame.glint),
          glass.fill,
          fracture,
        ),
        fill * back * stageAlpha,
      );
      ctx.fill();
      if (reflection && facing > 0) {
        ctx.save();
        ctx.globalAlpha *=
          fracture *
          back *
          stageAlpha *
          (0.12 + fresnel * 0.2 + highlight * 0.6);
        ctx.fillStyle = reflection;
        ctx.fill();
        ctx.restore();
      }
      ctx.lineWidth = mobile ? 0.5 : 0.65;
      ctx.strokeStyle = gray(
        mix(frame.ink, glass.edge, fracture),
        mix(
          0.018 + frame.split * 0.025 + fresnel * 0.03,
          0.22 + fresnel * 0.2,
          fracture,
        ) *
          back *
          stageAlpha *
          frame.drawing.faceDefinition,
      );
      ctx.stroke();
      if (highlight > 0.02 || fresnel > 0.35) {
        if (fracture < 1) {
          ctx.strokeStyle = gray(
            mix(frame.ink, glass.glint, frame.glint),
            (highlight * mix(0.16, 0.85, frame.glint) +
              fresnel * mix(0.06, 0.3, frame.glint)) *
              (1 - frame.split) *
              (1 - fracture) *
              back *
              stageAlpha,
          );
          ctx.lineWidth = 0.9 + highlight * 1.5;
          ctx.stroke();
        }
        if (fracture > 0) {
          const center = {
            x: (face.points[0].x + face.points[1].x + face.points[2].x) / 3,
            y: (face.points[0].y + face.points[1].y + face.points[2].y) / 3,
          };
          for (let i = 0; i < 3; i++) {
            const a = face.points[i],
              b = face.points[(i + 1) % 3];
            const dx = (a.x + b.x) / 2 - center.x,
              dy = (a.y + b.y) / 2 - center.y;
            const facingLight = Math.max(
              0,
              (dx * light.x - dy * light.y) /
                Math.max(
                  0.001,
                  Math.hypot(dx, dy) * Math.hypot(light.x, light.y),
                ),
            );
            const strength =
              (highlight * 0.65 + fresnel * 0.13) *
              facingLight ** 3 *
              fracture *
              back *
              stageAlpha;
            if (strength < 0.005) continue;
            // A reflection catches part of an edge, not a solid white outline
            // around every side of a triangle. Edge weights change continuously.
            const glint = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            glint.addColorStop(0, gray(glass.glint, 0));
            glint.addColorStop(0.5, gray(glass.glint, strength));
            glint.addColorStop(1, gray(glass.glint, 0));
            ctx.strokeStyle = glint;
            ctx.lineWidth = 0.8 + highlight * 0.8;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      if (fracture > 0.001 && face.dots?.length) {
        ctx.save();
        ctx.globalAlpha *= fracture * (facing < 0 ? 0.1 : 0.72);
        ctx.fillStyle = gray(glass.edge);
        const size =
          (mobile ? 0.65 : 1.25) * (0.75 + Math.max(0, facing) * 0.35);
        // Batch only the dots on this small triangle: bounded raster area and
        // one fill per shard, without a viewport-sized compound point-cloud path.
        ctx.beginPath();
        for (const dot of face.dots) {
          const radius = size * dot.perspective;
          ctx.moveTo(dot.x + radius, dot.y);
          ctx.arc(dot.x, dot.y, radius, 0, TAU);
        }
        ctx.fill();
        ctx.restore();
      }
    }
  };
  const drawGlassBody = (frame: Frame) => {
    if (frame.coreAlpha < 0.003) return;
    const center = project({ x: 0, y: 0, z: 0 }, frame),
      r = frame.radius * 1.012 * sceneSphereScale(frame.distance);
    ctx.save();
    ctx.globalAlpha *= frame.coreAlpha;
    const body = ctx.createRadialGradient(
      center.x - r * 0.24,
      center.y - r * 0.3,
      r * 0.04,
      center.x,
      center.y,
      r,
    );
    body.addColorStop(0, gray(255, 0.015 * frame.internalAlpha));
    body.addColorStop(
      0.42,
      gray(mix(155, 255, frame.dark), 0.04 * frame.internalAlpha),
    );
    body.addColorStop(0.78, gray(mix(90, 12, frame.dark), 0.105));
    body.addColorStop(0.95, gray(mix(65, 8, frame.dark), 0.25));
    body.addColorStop(1, gray(mix(35, 5, frame.dark), 0.34));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = gray(mix(60, 0, frame.dark), 0.38);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(center.x, center.y, r + 2, -0.94 * Math.PI, -0.29 * Math.PI);
    ctx.strokeStyle = gray(150, 0.22);
    ctx.lineWidth = mobile ? 1.2 : 1.8;
    ctx.stroke();
    if (frame.glint > 0) {
      ctx.strokeStyle = gray(255, frame.glint * 0.8);
      ctx.lineWidth = mobile ? 1.4 : 2.2;
      ctx.stroke();
    }
    ctx.restore();
  };
  const drawGraticule = (frame: Frame) => {
    const opacity = (1 - frame.split) * (1 - fractureAmount(frame));
    if (opacity < 0.001) return;
    for (let side = 0; side < 2; side++) {
      ctx.beginPath();
      for (const line of graticule) {
        let drawing = false,
          previousLayer = -1;
        for (const vertex of line) {
          const point = earthPoint(vertex, frame),
            layer = layerOf(vertex.z);
          if (point.z >= 0 !== (side === 1)) {
            drawing = false;
            continue;
          }
          const screen = project(point, frame);
          if (drawing && (frame.split < 0.12 || layer === previousLayer))
            ctx.lineTo(screen.x, screen.y);
          else ctx.moveTo(screen.x, screen.y);
          previousLayer = layer;
          drawing = true;
        }
      }
      ctx.lineWidth = mobile ? 0.46 : 0.6;
      ctx.strokeStyle = gray(frame.ink, (side === 1 ? 0.08 : 0.02) * opacity);
      ctx.stroke();
    }
  };
  const drawLand = (frame: Frame) => {
    if (ctx.globalAlpha < 0.002) return;
    const opacity = (1 - frame.split) ** 2 * (1 - fractureAmount(frame));
    if (opacity < 0.001) return;
    const buckets: { point: ScreenPoint; size: number }[][] = [[], [], [], []];
    const dotSize = mobile ? 1.02 : 1.32;
    for (const vertex of land) {
      const normal = scenePoint(rotate(vertex, frame.globeRotation), frame);
      if (normal.z < -0.07 && frame.split < 0.08) continue;
      const point = frame.split === 0 ? normal : earthPoint(vertex, frame);
      const depth = clamp((normal.z + 0.08) / 1.08),
        screen = project(point, frame);
      buckets[Math.min(3, Math.floor(depth * 3.999))].push({
        point: screen,
        size: dotSize * (0.57 + depth * 0.65) * screen.perspective,
      });
    }
    for (let i = 0; i < buckets.length; i++) {
      // The light globe's neutral surface is separate from shared UI accents.
      ctx.fillStyle = frame.drawing.landColor;
      ctx.save();
      ctx.globalAlpha *= (0.18 + i * 0.2) * opacity * frame.drawing.landOpacity;
      // Keep each dot's raster bounds small. One compound path containing several
      // thousand disconnected circles makes software Canvas rasterization costly.
      for (const { point, size } of buckets[i]) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  const ringPoint = (
    angle: number,
    layer: number,
    frame: Frame,
    radialOffset = 0,
  ): Vec3 => {
    const closedRadius = [1.055, 1.105, 1.175, 1.225][layer];
    const openRadius = [0.89, 1.03, 1.08, 0.95][layer];
    const radius = mix(closedRadius, openRadius, frame.split) + radialOffset;
    return scenePoint(
      {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: (layer - 1.5) * (0.035 + frame.split * 1.05),
      },
      frame,
    );
  };
  const buildRings = (frame: Frame) => {
    // The shell rotates continuously, but the rim's geometry changes only with
    // the scroll pose or viewport. Reuse its projected vertices between frames.
    const key = `${mobile}/${reducedMotion}/${frame.p}/${frame.distance}/${frame.radius}/${frame.cx}/${frame.cy}`;
    if (key === ringGeometryKey) return;
    ringGeometryKey = key;
    const count = mobile ? 80 : 128;
    ringLines = [];
    for (let layer = 0; layer < 4; layer++) {
      const inner: RingVertex[] = [];
      for (let i = 0; i <= count; i++) {
        const angle = (i / count) * TAU;
        const a = ringPoint(angle, layer, frame);
        inner.push({ point: project(a, frame), depth: a.z });
      }
      ringLines.push(inner);
    }
    const ticks = mobile ? 72 : 144;
    ringTicks = Array.from({ length: ticks }, (_, i) => {
      const angle = (i / ticks) * TAU,
        point = ringPoint(angle, 3, frame, 0.045);
      return {
        a: project(point, frame),
        b: project(
          ringPoint(angle, 3, frame, i % 6 === 0 ? 0.072 : 0.058),
          frame,
        ),
        depth: point.z,
      };
    });
  };
  const drawRings = (frame: Frame, front: boolean) => {
    const count = mobile ? 80 : 128,
      active = 0.55 + frame.research * 0.4 + frame.split * 0.15;
    const fracture = fractureAmount(frame);
    // The rim is a fine frame, not four opaque cylindrical collars. The colored
    // progress arc and travelling specular strokes retain their full definition.
    for (let layer = 0; layer < 4; layer++) {
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i <= count; i++) {
        const vertex = ringLines[layer][i];
        if (vertex.depth >= 0 !== front) {
          drawing = false;
          continue;
        }
        const screen = vertex.point;
        if (drawing) ctx.lineTo(screen.x, screen.y);
        else ctx.moveTo(screen.x, screen.y);
        drawing = true;
      }
      ctx.strokeStyle = gray(
        mix(frame.drawing.ringBase, frame.ink, fracture),
        active * (front ? mix(0.54, 0.85, fracture) : mix(0.23, 0.4, fracture)),
      );
      ctx.lineWidth = layer === 3 ? 1.05 : mix(0.55, 0.9, fracture);
      ctx.stroke();
      ctx.beginPath();
      drawing = false;
      const head = clock * (0.19 + layer * 0.015) + layer * 1.3 + frame.turn;
      for (let i = 0; i <= 30; i++) {
        const point = ringPoint(head + (i / 30) * 1.08, layer, frame, 0.014);
        if (point.z >= 0 !== front) {
          drawing = false;
          continue;
        }
        const screen = project(point, frame);
        if (drawing) ctx.lineTo(screen.x, screen.y);
        else ctx.moveTo(screen.x, screen.y);
        drawing = true;
      }
      ctx.strokeStyle = frame.drawing.ringHighlight;
      ctx.lineWidth = mobile ? 1 : mix(1.5, 2.2, fracture);
      ctx.stroke();
      if (fracture > 0) {
        ctx.strokeStyle = gray(
          sceneGlass(frame.dark).glint,
          fracture * (front ? 0.78 : 0.38),
        );
        ctx.stroke();
      }
      if (frame.glint > 0) {
        ctx.strokeStyle = gray(255, frame.glint * (front ? 0.85 : 0.35));
        ctx.stroke();
      }
    }
    ctx.beginPath();
    for (const { a, b, depth } of ringTicks) {
      if (depth >= 0 !== front) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = frame.drawing.tickColor;
    ctx.save();
    ctx.globalAlpha *= frame.drawing.tickOpacity;
    ctx.lineWidth = 0.65;
    ctx.stroke();
    ctx.restore();
  };
  const drawColorRim = (frame: Frame) => {
    if (frame.drawing.rimOpacity < 0.01) return;
    // Paper uses precise colored strokes; the dark stage carries the emission.
    const { paper, rimColors: colors } = frame.drawing;
    const gallery = clamp((frame.p - 0.42) / 0.4) * 8;
    const inGallery =
      smooth(0.4, 0.42, frame.p) * (1 - smooth(0.82, 0.84, frame.p));
    const stageAlpha =
      ctx.globalAlpha * frame.drawing.rimOpacity * (1 - frame.split);
    ctx.save();
    for (let segment = 0; segment < colors.length; segment++) {
      const color = colors[segment];
      const arc = (amount: number) => {
        ctx.beginPath();
        for (let step = 0; step <= 24; step++) {
          const angle =
            Math.PI / 2 -
            ((segment + 0.012 + (step / 24) * 0.976 * amount) / colors.length) *
              TAU;
          const point = project(ringPoint(angle, 3, frame, 0.008), frame);
          if (step) ctx.lineTo(point.x, point.y);
          else ctx.moveTo(point.x, point.y);
        }
      };
      const entering = reducedMotion
        ? 1
        : smooth(
            0.05 + segment * 0.08,
            1.3 + segment * 0.08,
            introProgress * 3,
          );
      const fill = mix(entering, clamp(gallery - segment), inGallery);
      const active =
        smooth(segment - 0.05, segment + 0.05, gallery) *
        (1 - smooth(segment + 0.95, segment + 1.05, gallery)) *
        inGallery;
      const stroke = (mobile ? 2.5 : 4) * (1 + active) * mix(1, 0.7, paper);
      ctx.strokeStyle = color;
      ctx.lineCap = "butt";
      arc(1);
      ctx.lineWidth = stroke;
      ctx.globalAlpha = stageAlpha * 0.14;
      ctx.stroke();
      if (fill < 0.001) continue;
      arc(fill);
      if (paper < 0.999) {
        ctx.lineWidth = stroke * 3.2;
        ctx.globalAlpha = stageAlpha * 0.08 * (1 - paper);
        ctx.stroke();
        ctx.lineWidth = stroke * 2;
        ctx.globalAlpha = stageAlpha * 0.16 * (1 - paper);
        ctx.stroke();
      }
      ctx.lineWidth = stroke;
      ctx.globalAlpha = stageAlpha;
      ctx.stroke();
    }
    ctx.restore();
  };
  const drawAssemblyLabels = (frame: Frame) => {
    const opacity =
      smooth(0.18, 0.25, frame.p) * (1 - smooth(0.32, 0.41, frame.p));
    const labels = (options.layerLabels ?? []).slice(0, 4);
    if (opacity < 0.01 || mobile || !labels.length) return;
    const inset = Math.max(64, (width - 1500) / 2 + 64);
    const top = Math.max(64, (height - 1024) / 2 + 64);
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.strokeStyle = stylePreset === "light" ? "#999" : "#99938c";
    ctx.fillStyle = stylePreset === "light" ? "#555" : "#5b5855";
    ctx.lineWidth = 0.7;
    ctx.font = "13px ui-monospace, SFMono-Regular, Consolas, monospace";
    labels.forEach((label, i) => {
      const right = i < 2;
      const y = right ? top + i * 26 : height - top - (3 - i) * 26;
      const labelWidth = ctx.measureText(label).width;
      const end = right
        ? width - inset - labelWidth - 4
        : inset + labelWidth + 4;
      const anchor = researchLayers.anchor(i, layerFrame(frame));
      const span = Math.min(Math.abs(anchor.y - y), Math.abs(end - anchor.x));
      const elbow = right ? anchor.x + span : anchor.x - span;
      const offset = (3 - i) * 0.003;
      const reveal =
        smooth(0.215 + offset, 0.265 + offset, frame.p) *
        (1 - smooth(0.335 + i * 0.003, 0.385 + i * 0.003, frame.p));
      // The stroke grows out of the text: horizontal first, then a 45-degree leader.
      strokePartial([{ x: end, y }, { x: elbow, y }, anchor], reveal);
      ctx.textAlign = right ? "right" : "left";
      ctx.fillText(label, right ? width - inset : inset, y + 4);
    });
    ctx.restore();
  };
  const drawLocation = (frame: Frame) => {
    if (!location || !locationPoint || frame.p >= 0.15) return;
    const opacity = 1 - smooth(0.04, 0.15, frame.p);
    const transformed = earthPoint(locationPoint, frame);
    const point = project(transformed, frame);
    const facing = smooth(0.02, 0.18, transformed.z);
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.font = `${mobile ? 11 : 13}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.fillStyle = frame.dark > 0.5 ? "#eeeae6" : "#333";
    const textWidth = ctx.measureText(location.label).width;
    if (mobile) {
      // A local label travels with the projected coordinate; no screen-edge leader.
      ctx.globalAlpha *= facing;
      const labelX = clamp(point.x - textWidth / 2, 12, width - textWidth - 12);
      const labelY = clamp(point.y - 18, 20, height - 72);
      ctx.textAlign = "left";
      ctx.strokeStyle = sceneBackground(1 - frame.dark, stylePreset);
      ctx.lineJoin = "round";
      ctx.lineWidth = 4;
      ctx.strokeText(location.label, labelX, labelY);
      ctx.fillText(location.label, labelX, labelY);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - 7);
      ctx.lineTo(point.x, labelY + 5);
    } else {
      const right = width - Math.max(64, (width - 1500) / 2 + 64);
      const y = Math.max(156, (height - 1024) / 2 + 136);
      ctx.textAlign = "right";
      ctx.fillText(location.label, right, y + 4);
      ctx.globalAlpha *= facing;
      const end = right - textWidth - 4;
      const elbow = Math.min(end, point.x + Math.abs(point.y - y));
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#85827e";
      ctx.lineJoin = "miter";
      strokePartial(
        [{ x: end, y }, { x: elbow, y }, point],
        reducedMotion ? 1 : smooth(0.3, 1.5, clock),
      );
      ctx.beginPath();
    }
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = "#85827e";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(point.x, point.y, mobile ? 3 : 4, 0, TAU);
    ctx.fillStyle = frame.dark > 0.5 ? "#f6f4f2" : "#111";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(point.x, point.y, mobile ? 7 : 9, 0, TAU);
    ctx.strokeStyle = sceneAccent(
      frame.p,
      stylePreset === "light" ? 1 - frame.dark : 0,
      options.projectCount,
    );
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };
  const drawAxialLayers = (frame: Frame, front: boolean) => {
    if (frame.split < 0.01) return;
    const count = mobile ? 48 : 80;
    const fracture = fractureAmount(frame);
    for (let layer = 0; layer < 4; layer++) {
      const z = (layer - 1.5) * frame.split * 1.05;
      for (let band = 0; band < 3; band++) {
        ctx.beginPath();
        let drawing = false;
        for (let i = 0; i <= count; i++) {
          const angle = (i / count) * TAU;
          const radius =
            0.35 +
            band * 0.19 +
            fracture *
              0.014 *
              Math.sin(angle * (3 + layer) + clock * 0.6 + layer);
          const point = scenePoint(
            { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z },
            frame,
          );
          if (point.z >= 0 !== front) {
            drawing = false;
            continue;
          }
          const screen = project(point, frame);
          if (drawing) ctx.lineTo(screen.x, screen.y);
          else ctx.moveTo(screen.x, screen.y);
          drawing = true;
        }
        ctx.strokeStyle = gray(frame.ink, frame.split * (front ? 0.54 : 0.22));
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
    }
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * TAU;
      const a3 = scenePoint(
        {
          x: Math.cos(angle) * 0.78,
          y: Math.sin(angle) * 0.78,
          z: -1.5 * frame.split * 1.05,
        },
        frame,
      );
      const b3 = scenePoint(
        {
          x: Math.cos(angle) * 0.78,
          y: Math.sin(angle) * 0.78,
          z: 1.5 * frame.split * 1.05,
        },
        frame,
      );
      if (a3.z + b3.z >= 0 !== front) continue;
      const a = project(a3, frame),
        b = project(b3, frame);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    // Axial construction lines belong to the assembly, not to the unbroken
    // shell. Keep them visible when the mirror fragments are fully open.
    ctx.strokeStyle = gray(frame.ink, frame.split * (front ? 0.24 : 0.12));
    ctx.lineWidth = 0.65;
    ctx.stroke();
  };
  const createWireGeometry = () => {
    wireGeometry = [];
    const count = mobile ? 48 : 80;
    for (let layer = 0; layer < 4; layer++) {
      const from = -1 + layer * 0.5;
      for (let ring = 0; ring <= 6; ring++) {
        const z = from + (ring / 6) * 0.5;
        const radius = Math.sqrt(Math.max(0, 1 - z * z));
        const points = Array.from({ length: count + 1 }, (_, i) => ({
          x: Math.cos((i / count) * TAU) * radius,
          y: Math.sin((i / count) * TAU) * radius,
          z,
        }));
        wireGeometry.push({
          layer,
          points,
          lineWidth: ring === 0 || ring === 6 ? 0.9 : 0.4,
        });
      }
      for (let meridian = 0; meridian < 12; meridian++) {
        const angle = (meridian / 12) * TAU;
        const points = Array.from({ length: 17 }, (_, i) => {
          const z = from + (i / 16) * 0.5,
            radius = Math.sqrt(Math.max(0, 1 - z * z));
          return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            z,
          };
        });
        wireGeometry.push({ layer, points, lineWidth: 0.4 });
      }
    }
  };
  const buildWireShell = (frame: Frame) => {
    // Called after buildRings: both use the same scroll/size projection, while
    // globe rotation and ring highlights continue to animate independently.
    if (wireGeometryKey === ringGeometryKey) return;
    wireGeometryKey = ringGeometryKey;
    wireLines =
      frame.split < 0.002
        ? []
        : wireGeometry.map((curve) => ({
            lineWidth: curve.lineWidth,
            points: curve.points.map((point) =>
              project(
                scenePoint(
                  {
                    x: point.x,
                    y: point.y,
                    z: point.z + (curve.layer - 1.5) * frame.split * 0.96,
                  },
                  frame,
                ),
                frame,
              ),
            ),
          }));
  };
  const drawWireShell = (frame: Frame, front: boolean) => {
    if (!wireLines.length) return;
    ctx.save();
    ctx.globalAlpha *=
      frame.split * (front ? 0.65 : 0.2) * (1 - fractureAmount(frame) * 0.82);
    ctx.strokeStyle = "#69645f";
    for (const curve of wireLines) {
      ctx.beginPath();
      let drawing = false;
      for (const point of curve.points) {
        if (point.z >= 0 !== front) {
          drawing = false;
          continue;
        }
        if (drawing) ctx.lineTo(point.x, point.y);
        else ctx.moveTo(point.x, point.y);
        drawing = true;
      }
      ctx.lineWidth = curve.lineWidth;
      ctx.stroke();
    }
    ctx.restore();
  };
  const drawFlow = (frame: Frame, front: boolean) => {
    if (frame.split < 0.01 && frame.research < 0.01) return;
    const active = Math.max(frame.split, frame.research * 0.42),
      count = mobile ? 48 : 90;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const angle = noise(i + 30) * TAU + clock * (0.25 + noise(i + 71) * 0.4),
        layer = i % 4;
      const a3 = ringPoint(angle, layer, frame, -0.08 - noise(i + 8) * 0.1);
      if (a3.z >= 0 !== front) continue;
      const b3 = ringPoint(
        angle - 0.015 - noise(i + 21) * 0.045,
        layer,
        frame,
        -0.08 - noise(i + 8) * 0.1,
      );
      const a = project(a3, frame),
        b = project(b3, frame);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = gray(frame.ink, active * (front ? 0.55 : 0.16));
    ctx.lineWidth = 1.05;
    ctx.stroke();
  };
  const drawReflections = (frame: Frame) => {
    if (frame.coreAlpha < 0.005) return;
    const center = project({ x: 0, y: 0, z: 0 }, frame),
      r = frame.radius * sceneSphereScale(frame.distance);
    ctx.save();
    ctx.globalAlpha *= frame.coreAlpha * mix(0.13, 0.95, frame.glint);
    ctx.beginPath();
    ctx.arc(center.x, center.y, r * 1.014, 0, TAU);
    ctx.clip();
    ctx.translate(center.x, center.y);
    ctx.rotate(-0.4);
    // A finite, feathered softbox bends with the glass. The previous uniform
    // linear band crossed the entire globe and read as a white column at crest.
    ctx.scale(0.68, 1);
    const reflection = ctx.createRadialGradient(
      -r * 0.48,
      -r * 0.38,
      r * 0.02,
      -r * 0.24,
      -r * 0.2,
      r * 0.96,
    );
    reflection.addColorStop(0, gray(255, 0.12));
    reflection.addColorStop(0.18, gray(255, 0.36));
    reflection.addColorStop(0.35, gray(255, 0.2));
    reflection.addColorStop(0.6, gray(255, 0.055));
    reflection.addColorStop(1, gray(255, 0));
    ctx.fillStyle = reflection;
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    // Glass is conveyed by the surface reflection above. The former thick
    // elliptical hook was an unrelated white mark, not part of the glass mesh.
    ctx.restore();
  };
  const draw = () => {
    if (destroyed || suspended || width < 2 || height < 2) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const frame = frameState();
    if (frame.opacity < 0.002 || frame.exit >= 1) return;
    ctx.globalAlpha = frame.opacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const globeAlpha = researchBlend(frame.stack).globe;
    if (globeAlpha > 0.001) {
      ctx.save();
      ctx.globalAlpha *= globeAlpha;
      buildFaces(frame);
      buildRings(frame);
      buildWireShell(frame);
      drawRings(frame, false);
      ctx.save();
      ctx.globalAlpha *= smooth(0.28, 0.78, introProgress);
      drawAxialLayers(frame, false);
      drawWireShell(frame, false);
      drawFlow(frame, false);
      const continentalReveal =
        frame.continental < 0
          ? 0
          : smooth(0, 0.13, frame.continental) *
            (1 - smooth(0.91, 1, frame.continental)) *
            frame.continentalVisibility;
      if (continentalReveal > 0) {
        ctx.save();
        ctx.globalAlpha *= 1 - continentalReveal;
        drawFaces(frame, false);
        if (continentalReveal < 0.998) drawGraticule(frame);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha *= 1 - continentalReveal * 0.85;
        drawGlassBody(frame);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha *= 1 - continentalReveal;
        drawLand(frame);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha *= 1 - continentalReveal;
        drawFaces(frame, true);
        drawReflections(frame);
        ctx.restore();
        continents ??= createContinentalRenderer(land);
        ctx.save();
        ctx.globalAlpha *= frame.continentalVisibility;
        continents.draw(ctx, {
          phase: frame.continental,
          amplitude:
            (options.continentalDrift
              ? options.continentalDrift.amplitude
              : 1) *
            (mobile ? 0.66 : 1) *
            frame.continentalVisibility,
          spread: options.continentalDrift
            ? options.continentalDrift.spread
            : 1,
          clock,
          geometryKey: `${faceGeometryKey}/${frame.continental}/${clock}/${frame.continentalVisibility}`,
          bounds: {
            cx: frame.cx,
            cy: frame.cy,
            left: 16,
            right: width - 16,
            top: 24,
            bottom: height - (mobile ? 90 : 24),
          },
          mobile,
          landColor: frame.drawing.landColor,
          landOpacity: frame.drawing.landOpacity,
          material: sceneGlass(frame.dark),
          globe: (point) =>
            scenePoint(rotate(point, frame.globeRotation), frame),
          project: (point) => project(point, frame),
        });
        ctx.restore();
      } else {
        drawFaces(frame, false);
        drawGlassBody(frame);
        drawGraticule(frame);
        drawLand(frame);
        drawFaces(frame, true);
        drawReflections(frame);
      }
      drawAxialLayers(frame, true);
      drawWireShell(frame, true);
      drawFlow(frame, true);
      drawLocation(frame);
      ctx.restore();
      drawRings(frame, true);
      drawColorRim(frame);
      if (introProgress < 0.7) {
        const dots =
          smooth(0.04, 0.2, introProgress) *
          (1 - smooth(0.4, 0.7, introProgress));
        const spacing = mobile ? 10 : 16;
        ctx.fillStyle = sceneAccent(
          frame.p,
          stylePreset === "light" ? 1 - frame.dark : 0,
          options.projectCount,
        );
        for (let i = 0; i < 9; i++) {
          ctx.globalAlpha =
            dots *
            (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(introProgress * 24 - i * 0.6)));
          ctx.beginPath();
          ctx.arc(
            frame.cx + ((i % 3) - 1) * spacing,
            frame.cy + (Math.floor(i / 3) - 1) * spacing,
            mobile ? 2 : 3,
            0,
            TAU,
          );
          ctx.fill();
        }
      }
      ctx.restore();
    }
    researchLayers.draw(ctx, layerFrame(frame));
    drawAssemblyLabels(frame);
    ctx.globalAlpha = 1;
  };

  const canRender = () =>
    !destroyed && !suspended && visible && (!browser || !document.hidden);
  const tick = (time: number) => {
    raf = 0;
    if (!canRender()) {
      lastTime = 0;
      return;
    }
    const delta = lastTime ? Math.min(50, time - lastTime) : 16.7;
    lastTime = time;
    if (!paused && !reducedMotion) clock += delta / 1000;
    draw();
    if (!paused && !reducedMotion && progress < 1)
      raf = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (!autoStart) return;
    if (!raf && canRender()) {
      lastTime = 0;
      raf = requestAnimationFrame(tick);
    }
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
  };

  const resize = () => {
    if (destroyed) return;
    const rect =
      typeof canvas.getBoundingClientRect === "function"
        ? canvas.getBoundingClientRect()
        : null;
    const nextWidth = Math.max(
      1,
      options.width ?? rect?.width ?? canvas.clientWidth ?? canvas.width,
    );
    const nextHeight = Math.max(
      1,
      options.height ?? rect?.height ?? canvas.clientHeight ?? canvas.height,
    );
    const nextMobile = nextWidth < sceneLayout.mobile;
    const nextDpr = Math.min(
      options.pixelRatio ?? (browser ? window.devicePixelRatio || 1 : 1),
      nextMobile ? 1.5 : 1.8,
    );
    const needsGeometry = !shell.length || nextMobile !== mobile;
    width = nextWidth;
    height = nextHeight;
    mobile = nextMobile;
    dpr = nextDpr;
    const backingWidth = Math.round(width * dpr),
      backingHeight = Math.round(height * dpr);
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    if (needsGeometry) {
      shards = null;
      continents?.destroy();
      continents = null;
      faceGeometryKey = "";
      fitGeometryKey = "";
      spinEnvelope = [];
      envelopeSplit = -1;
      createWireGeometry();
      shell = createGlassShell(mobile ? 16 : 24, mobile ? 8 : 12);
      graticule = createGraticule(mobile ? 30 : 20);
      land = sourceLand
        .filter((_, index) => !mobile || index % 2 === 0)
        .map((point) =>
          spherePoint(
            (point[0] * Math.PI) / 180,
            (point[1] * Math.PI) / 180,
            1.004,
          ),
        );
    }
    if (!autoStart) draw();
    else wake();
  };

  const onVisibility = () => {
    if (document.hidden) stop();
    else wake();
  };
  const intersectionObserver =
    browser && autoStart && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          (entries) => {
            visible = entries[0]?.isIntersecting ?? false;
            if (visible) wake();
            else stop();
          },
          { rootMargin: "60px" },
        )
      : null;
  const resizeObserver =
    browser && autoStart && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(resize)
      : null;
  intersectionObserver?.observe(canvas);
  resizeObserver?.observe(canvas);
  if (browser && autoStart) {
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize, { passive: true });
  }
  resize();

  return {
    setToolsBounds(bounds) {
      const same = (a?: ReadingBounds | null, b?: ReadingBounds | null) =>
        a?.left === b?.left &&
        a?.right === b?.right &&
        a?.top === b?.top &&
        a?.bottom === b?.bottom;
      if (
        destroyed ||
        (same(toolsBounds, bounds) &&
          toolsBounds?.lines?.length === bounds?.lines?.length &&
          (toolsBounds?.lines ?? []).every((line, i) =>
            same(line, bounds?.lines?.[i]),
          ))
      )
        return;
      toolsBounds = bounds;
      faceGeometryKey = "";
      fitGeometryKey = "";
      if (paused || reducedMotion || !autoStart) draw();
      else wake();
    },
    setIntroProgress(value) {
      if (destroyed || !Number.isFinite(value)) return;
      introProgress = clamp(value);
      if (!autoStart || paused || reducedMotion) draw();
      else wake();
    },
    setProgress(value) {
      if (destroyed || !Number.isFinite(value)) return;
      snapshot = false;
      const next = clamp(value);
      if (Math.abs(progress - next) < 0.00001) return;
      progress = next;
      continentalPlayback.sample(progress, clock, reducedMotion);
      if (!autoStart) draw();
      else wake();
    },
    setSpin(value) {
      if (destroyed || !Number.isFinite(value) || spin === value) return;
      spin = value;
      if (!autoStart || paused || reducedMotion) draw();
      else wake();
    },
    setMobileLayout(layout) {
      if (destroyed) return;
      if (
        mobileLayout === layout ||
        (mobileLayout &&
          layout &&
          mobileLayout.centerY === layout.centerY &&
          mobileLayout.radius === layout.radius)
      )
        return;
      mobileLayout = layout;
      if (!autoStart) draw();
      else wake();
    },
    setPaused(value) {
      if (destroyed || paused === value) return;
      paused = value;
      if (paused) {
        stop();
        draw();
      } else wake();
    },
    setSuspended(value) {
      if (destroyed || suspended === value) return;
      suspended = value;
      if (suspended) stop();
      else if (!autoStart) draw();
      else wake();
    },
    setReducedMotion(value) {
      if (destroyed || reducedMotion === value) return;
      reducedMotion = value;
      stop();
      draw();
      if (!reducedMotion && !paused) wake();
    },
    drawAtProgress(value, timeSeconds = 0, mode = "snapshot") {
      if (destroyed) return;
      progress = Number.isFinite(value) ? clamp(value) : 0;
      clock = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
      snapshot = mode === "snapshot";
      draw();
    },
    resize,
    destroy(clearCanvas = true) {
      if (destroyed) return;
      destroyed = true;
      stop();
      intersectionObserver?.disconnect();
      resizeObserver?.disconnect();
      if (browser && autoStart) {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", resize);
      }
      shell = [];
      land = [];
      graticule = [];
      projectedFaces = [];
      wireGeometry = [];
      wireLines = [];
      shards = null;
      continents?.destroy();
      continents = null;
      spinEnvelope = [];
      ringLines = [];
      ringTicks = [];
      researchLayers.destroy();
      if (clearCanvas) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
  };
}

/** Works with a browser canvas or a structurally compatible @napi-rs/canvas. */
export function drawAtProgress(
  canvas: HTMLCanvasElement,
  progress: number,
  options: EarthRendererOptions & { timeSeconds?: number } = {},
): void {
  const renderer = createEarthRenderer(canvas, {
    ...options,
    autoStart: false,
  });
  renderer.drawAtProgress(progress, options.timeSeconds ?? 0);
  renderer.destroy(false);
}
