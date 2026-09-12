import { mediaManifest } from "./media.generated";

/** Intrinsic dimensions reserve the correct space before an image arrives. */
export function mediaDimensions(src: string): { width: number; height: number } {
  const entry = mediaManifest[src];
  if (!entry?.width || !entry.height) throw new Error(`Image missing from the publication manifest: ${src}`);
  return { width: entry.width, height: entry.height };
}
