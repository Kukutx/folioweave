import { notFound } from "next/navigation";
import type { TemplateContext } from "@/core/contracts";
import { mediaDimensions } from "@/portfolio/media";
import { photographs, pondLabels } from "./data";
import { Shell } from "./shell";
import s from "./pond.module.css";

function size(src: string) {
  try {
    return mediaDimensions(src);
  } catch {
    return null;
  }
}

/** The photographs, with the profile's photography intro over them. */
export default function GalleryPage({ context }: { context: TemplateContext }) {
  const images = photographs(context);
  if (!images.length) notFound();
  const intro = context.photography?.intro?.trim();
  return (
    <Shell context={context} current="gallery">
      <h1 className={s.title}>{pondLabels(context).gallery}</h1>
      {intro && <p className={s.lead}>{intro}</p>}
      <ul className={s.photos}>
        {images.map((image, i) => {
          const dimensions = size(image.src);
          return (
            <li key={image.src}>
              <figure className={s.photo}>
                <img
                  src={image.src}
                  alt={image.alt}
                  width={dimensions?.width}
                  height={dimensions?.height}
                  loading={i < 4 ? "eager" : "lazy"}
                  decoding="async"
                />
              </figure>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

export function describe(context: TemplateContext) {
  return {
    title: pondLabels(context).gallery,
    description: context.photography?.intro || undefined,
  };
}
