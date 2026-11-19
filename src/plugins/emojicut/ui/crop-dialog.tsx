"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Check, X } from "lucide-react";
import type { Copy } from "../copy";
import type { Rect } from "../cut/segment";
import { Modal } from "./modal";
import styles from "./dialog.module.css";

type Size = { w: number; h: number };

const MIN_SIDE = 5;

/** Draw a box on the sheet (pointer or arrow keys) to cut one more sticker. */
export function CropDialog({
  copy,
  imageUrl,
  onClose,
  onConfirm,
}: {
  copy: Copy;
  imageUrl: string;
  onClose: () => void;
  onConfirm: (rect: Rect) => void;
}) {
  const titleId = useId();
  const hintId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  /** A pointer position in the image's own pixels. */
  const toImage = (event: PointerEvent<HTMLElement>) => {
    const image = imageRef.current;
    if (!image || !natural) return null;
    const box = image.getBoundingClientRect();
    const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
    return {
      x: clamp(((event.clientX - box.left) / box.width) * natural.w, natural.w),
      y: clamp(((event.clientY - box.top) / box.height) * natural.h, natural.h),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = toImage(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = point;
    setRect({ minX: point.x, maxX: point.x, minY: point.y, maxY: point.y });
  };

  const onPointerMove = (event: PointerEvent<HTMLImageElement>) => {
    const from = start.current;
    const point = from && toImage(event);
    if (!from || !point) return;
    setRect({
      minX: Math.min(from.x, point.x),
      maxX: Math.max(from.x, point.x),
      minY: Math.min(from.y, point.y),
      maxY: Math.max(from.y, point.y),
    });
  };

  const endDrag = () => {
    start.current = null;
  };

  // Arrows move the box, Shift+arrows resize it, Enter adds the sticker.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!natural) return;
    if (event.key === "Enter") {
      event.preventDefault();
      confirm();
      return;
    }
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ];
    if (!step) return;
    event.preventDefault();
    const dx = step[0] * Math.max(1, natural.w * 0.02);
    const dy = step[1] * Math.max(1, natural.h * 0.02);
    setRect((current) => {
      const box = current ?? {
        minX: natural.w * 0.375,
        maxX: natural.w * 0.625,
        minY: natural.h * 0.375,
        maxY: natural.h * 0.625,
      };
      if (!current) return box;
      if (event.shiftKey)
        return {
          ...box,
          maxX: Math.min(natural.w, Math.max(box.minX + MIN_SIDE + 1, box.maxX + dx)),
          maxY: Math.min(natural.h, Math.max(box.minY + MIN_SIDE + 1, box.maxY + dy)),
        };
      const x = Math.max(-box.minX, Math.min(natural.w - box.maxX, dx));
      const y = Math.max(-box.minY, Math.min(natural.h - box.maxY, dy));
      return { minX: box.minX + x, maxX: box.maxX + x, minY: box.minY + y, maxY: box.maxY + y };
    });
  };

  const usable = rect && rect.maxX - rect.minX > MIN_SIDE && rect.maxY - rect.minY > MIN_SIDE;
  const confirm = () => {
    if (usable) onConfirm(rect);
  };

  const overlay =
    rect && natural
      ? {
          left: `${(rect.minX / natural.w) * 100}%`,
          top: `${(rect.minY / natural.h) * 100}%`,
          width: `${((rect.maxX - rect.minX) / natural.w) * 100}%`,
          height: `${((rect.maxY - rect.minY) / natural.h) * 100}%`,
        }
      : undefined;

  return (
    <Modal
      labelledBy={titleId}
      tone="dark"
      initialFocus={frameRef}
      onClose={onClose}
      className={styles.crop}
    >
      <div className={styles.cropHeader}>
        <div>
          <h2 id={titleId} className={styles.cropTitle}>
            {copy.cropTitle}
          </h2>
          <p id={hintId} className={styles.cropHint}>
            {copy.cropHint}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={styles.cropClose}
          aria-label={copy.close}
        >
          <X size={22} aria-hidden />
        </button>
      </div>

      <div
        ref={frameRef}
        className={styles.frame}
        tabIndex={0}
        role="group"
        aria-label={copy.cropImage}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt={copy.cropImage}
          className={styles.cropImage}
          draggable={false}
          onLoad={(event) =>
            setNatural({
              w: event.currentTarget.naturalWidth,
              h: event.currentTarget.naturalHeight,
            })
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        />
        {overlay && <div className={styles.selection} style={overlay} />}
      </div>

      <div className={styles.cropActions}>
        <button type="button" onClick={onClose} className={styles.cropCancel}>
          {copy.cancel}
        </button>
        <button type="button" onClick={confirm} disabled={!usable} className={styles.cropAdd}>
          <Check size={18} aria-hidden />
          {copy.cropAdd}
        </button>
      </div>
    </Modal>
  );
}
