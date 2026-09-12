"use client";

import { useState } from "react";
import { MediaCarousel } from "@/components/media/media-carousel";
import type { PortfolioMediaAsset } from "@/portfolio/schema";

export function CarouselStates({
  images,
}: {
  images: readonly PortfolioMediaAsset[];
}) {
  const [populated, setPopulated] = useState(true);
  return (
    <>
      <button onClick={() => setPopulated((value) => !value)}>
        {populated ? "Clear carousel" : "Load carousel"}
      </button>
      <MediaCarousel images={populated ? images : []} />
    </>
  );
}
