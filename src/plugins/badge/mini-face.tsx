"use client";

import { useEffect, useRef } from "react";
import { paintCardFace } from "./lanyard/face";
import type { Card } from "./settings";

/** Pixels of the small badge's face (its CSS size times two). */
const SIZE = { width: 116, height: 154 };

/**
 * The front card's face at the small badge's size: its picture, or the face
 * drawn from its text exactly as on the open badge, or its plain colour.
 */
export function MiniFace({ card }: { card: Card }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawn =
    !card.frontImage &&
    Boolean(card.logo || card.title || card.kicker || card.description);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!drawn || !canvas) return;
    let current = true;
    const paint = (logo: HTMLImageElement | null) => {
      if (current) paintCardFace(canvas, { ...card, logo });
    };
    paint(null);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => paint(image);
    if (card.logo) image.src = card.logo;
    void document.fonts?.ready.then(() =>
      paint(image.complete && image.naturalWidth ? image : null),
    );
    return () => {
      current = false;
    };
  }, [card, drawn]);

  if (card.frontImage)
    return (
      <img
        src={card.frontImage}
        alt=""
        draggable={false}
        decoding="async"
        style={{ objectFit: card.imageFit }}
      />
    );
  return drawn ? (
    <canvas ref={canvasRef} width={SIZE.width} height={SIZE.height} aria-hidden="true" />
  ) : null;
}
