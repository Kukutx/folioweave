import type { ComponentType } from "react";
import type { Lanyard } from "./lanyard";

type LanyardComponent = ComponentType<Parameters<typeof Lanyard>[0]>;

let pending: Promise<LanyardComponent> | null = null;

/**
 * The 3D scene (three and the simulation), fetched once on first intent and
 * kept for later openings. A failed download is forgotten so the next
 * attempt fetches again.
 */
export function loadLanyard() {
  pending ??= import("./lanyard").then(
    (module) => module.Lanyard,
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}
