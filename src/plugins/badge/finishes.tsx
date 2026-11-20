/** Metal finishes shared by the full lanyard and the small badge. */
export type Finish = "silver" | "gold" | "black";

type Stops = readonly (readonly [number, string])[];
export const FINISHES: Record<
  Finish,
  { sleeve: Stops; metal: Stops; shine: string }
> = {
  silver: {
    sleeve: [
      [0, "#dcdcd6"],
      [0.12, "#f3f3ef"],
      [0.32, "#d6d5d1"],
      [0.62, "#a6a5a1"],
      [0.86, "#72736e"],
      [1, "#5a5b57"],
    ],
    metal: [
      [0, "#a4a7ac"],
      [0.35, "#6d7076"],
      [0.7, "#45474c"],
      [1, "#7b7e84"],
    ],
    shine: "#ffffff",
  },
  gold: {
    sleeve: [
      [0, "#fff4d2"],
      [0.2, "#eed592"],
      [0.52, "#caa55a"],
      [0.82, "#957330"],
      [1, "#6c5121"],
    ],
    metal: [
      [0, "#ead190"],
      [0.35, "#b99441"],
      [0.7, "#85662b"],
      [1, "#c4a259"],
    ],
    shine: "#fff8e4",
  },
  black: {
    sleeve: [
      [0, "#5c5c60"],
      [0.2, "#3d3d41"],
      [0.52, "#29292c"],
      [0.82, "#1b1b1e"],
      [1, "#111113"],
    ],
    metal: [
      [0, "#606166"],
      [0.35, "#37383c"],
      [0.7, "#1e1f22"],
      [1, "#48494e"],
    ],
    shine: "#c8cad0",
  },
};

export function Gradient({
  id,
  stops,
  x1 = 0,
  x2 = 1,
  y1 = 0,
  y2 = 0,
  space,
}: {
  id: string;
  stops: Stops;
  /** Horizontal extent in user units, so every part of a drawing is lit
   * alike; otherwise each shape's own box. */
  space?: readonly [number, number];
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
}) {
  return (
    <linearGradient
      id={id}
      {...(space
        ? {
            gradientUnits: "userSpaceOnUse",
            x1: space[0],
            x2: space[1],
            y1: 0,
            y2: 0,
          }
        : { x1, x2, y1, y2 })}
    >
      {stops.map(([offset, color]) => (
        <stop key={offset} offset={offset} stopColor={color} />
      ))}
    </linearGradient>
  );
}
