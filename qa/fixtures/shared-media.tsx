"use client";

import { useState } from "react";
import { MediaCarousel } from "@/components/media/media-carousel";
import { GalleryLightbox } from "@/components/media/gallery";
import type { PortfolioMediaAsset } from "@/portfolio/schema";

/** Runs inside an independent template without Classic CSS or reset styles. */
export function SharedMediaFixture({
  images,
}: {
  images: PortfolioMediaAsset[];
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(images.length);
  const visibleImages = images.slice(0, count);
  return (
    <section data-shared-media>
      <MediaCarousel images={visibleImages} />
      <button type="button" onClick={() => setCount(1)}>
        Keep one shared image
      </button>
      <button type="button" onClick={() => setCount(0)}>
        Clear shared images
      </button>
      <button type="button" onClick={() => setCount(images.length)}>
        Restore shared images
      </button>
      <button type="button" onClick={() => setOpen(true)}>
        Open shared gallery
      </button>
      {open && (
        <GalleryLightbox
          images={visibleImages}
          initialIndex={99}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}
