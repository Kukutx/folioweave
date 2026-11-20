import { notFound } from "next/navigation";
import type { TemplateContext } from "@/core/contracts";
import { mediaDimensions } from "@/portfolio/media";
import { photographs, pondLabels } from "./data";
import { Photos, type Photo } from "./photos";
import { Head, Shell } from "./shell";

function size(src: string) {
  try {
    return mediaDimensions(src);
  } catch {
    return null;
  }
}

/** The photographs, laid out on the bank at their own proportions, under the profile's words about them. */
export default function GalleryPage({ context }: { context: TemplateContext }) {
  const images = photographs(context);
  if (!images.length) notFound();
  const labels = pondLabels(context);
  const intro = context.photography?.intro?.trim();
  const photos: Photo[] = images.map((image) => {
    const dimensions = size(image.src);
    return { src: image.src, alt: image.alt, width: dimensions?.width, height: dimensions?.height };
  });
  return (
    <Shell context={context} current="gallery" head={<Head title={labels.gallery} lead={intro} />}>
      <Photos photos={photos} labels={{ close: labels.close, previous: labels.previous, next: labels.next }} />
    </Shell>
  );
}

export function describe(context: TemplateContext) {
  return {
    title: pondLabels(context).gallery,
    description: context.photography?.intro || undefined,
  };
}
