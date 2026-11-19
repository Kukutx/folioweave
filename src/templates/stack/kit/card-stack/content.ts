// Card types for <CardStack> (the recorded card shuffle). The original's payment cards are not shipped;
// Stack passes the projects' pictures as image cards.

export type PaymentCard = {
  kind?: "payment";
  /** Shown big, e.g. "$4,200". */
  amount: string;
  from: string;
  to: string;
  /** Shown in quotes under the names. */
  note?: string;
  /** Shown bottom right, e.g. "3h". */
  time?: string;
  /** Image URLs for the payer and the payee; a coloured initial is shown where one is missing. */
  avatars?: [string?, string?];
  /** Verified badges after the names (default true). */
  verified?: boolean;
  /** How this card lies when it is behind the front card: offset (px) and tilt (deg). Defaults by position. */
  rest?: CardRest;
};

/** A card's pose while it sits behind the front card (stack layout). */
export type CardRest = { x: number; y: number; r: number };

/** A looping clip stored as frame atlases (cols × rows tiles of tile[0] × tile[1] px each). */
export type FramesCard = {
  kind: "frames";
  label?: string;
  atlases: string[];
  tile: [number, number];
  cols: number;
  perAtlas: number;
  frames: number;
  fps: number;
  rest?: CardRest;
};

export type ImageCard = { kind: "image"; src: string; label?: string; rest?: CardRest };

export type StackCard = PaymentCard | FramesCard | ImageCard;

/** No default cards: the template always passes the profile's pictures. */
export const CARDS: StackCard[] = [];

/** The recorded tilts of the four cards when they lie behind (cycled for longer stacks). */
export const RESTS: CardRest[] = [
  { x: 13.8, y: 3.4, r: -12.6 },
  { x: 10, y: 0, r: 4.6 },
  { x: 8.9, y: 4.7, r: 11.8 },
  { x: 1.2, y: 3.2, r: 5.8 },
];
