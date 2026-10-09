"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type PointerEvent,
  type CSSProperties,
} from "react";
import { clamp } from "@/components/refract/lib/motion";

export type SceneTimelineHandle = {
  setPosition(position: number): void;
  isDragging(): boolean;
};

/** Reference track: continuous seeking, hover ghost and an enlarged grabbed cursor. */
export const SceneTimeline = forwardRef<
  SceneTimelineHandle,
  {
    labels: readonly string[];
    /** Accessible name of the chapter slider. */
    name: string;
    chapter: number;
    onSeek(position: number): void;
    onRelease(): void;
  }
>(function SceneTimeline({ labels, name, chapter, onSeek, onRelease }, ref) {
  const track = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const grabbed = useRef(false);
  const writtenPosition = useRef(-1);
  const writePosition = (position: number) => {
    const value = clamp(position);
    if (writtenPosition.current === value) return;
    writtenPosition.current = value;
    track.current?.style.setProperty("--scene-progress", String(value));
    if (input.current) input.current.value = String(value);
  };
  useImperativeHandle(
    ref,
    () => ({
      setPosition(position) {
        if (!grabbed.current) writePosition(position);
      },
      isDragging: () => grabbed.current,
    }),
    [],
  );
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return clamp((event.clientX - rect.left) / rect.width);
  };
  const seek = (position: number) => {
    writePosition(position);
    onSeek(position);
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (!grabbed.current) return;
    grabbed.current = false;
    event.currentTarget.dataset.dragging = "false";
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    onRelease();
  };
  return (
    <div
      className="chapter-navigation"
      ref={track}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        input.current?.focus({ preventScroll: true });
        grabbed.current = true;
        event.currentTarget.dataset.dragging = "true";
        event.currentTarget.dataset.preview = "false";
        event.currentTarget.setPointerCapture(event.pointerId);
        seek(point(event));
      }}
      onPointerMove={(event) => {
        const position = point(event);
        if (grabbed.current) seek(position);
        else if (event.pointerType === "mouse") {
          event.currentTarget.style.setProperty(
            "--preview-progress",
            String(position),
          );
          const current = input.current?.valueAsNumber ?? 0;
          const nearCursor =
            Math.abs(position - current) * event.currentTarget.clientWidth <=
            10;
          event.currentTarget.dataset.preview = String(!nearCursor);
          event.currentTarget.dataset.cursorHover = String(nearCursor);
        }
      }}
      onPointerLeave={(event) => {
        event.currentTarget.dataset.preview = "false";
        event.currentTarget.dataset.cursorHover = "false";
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div className="chapter-ticks" aria-hidden="true">
        {labels.map((label, i) => (
          <span
            key={label + i}
            style={{ "--tick-index": i } as CSSProperties}
          />
        ))}
      </div>
      <input
        className="chapter-slider"
        ref={input}
        type="range"
        min="0"
        max="1"
        step="0.0001"
        defaultValue="0"
        aria-label={name}
        aria-valuetext={labels[chapter]}
        onChange={(event) => seek(event.currentTarget.valueAsNumber)}
        onKeyDown={(event) => {
          const value = event.currentTarget.valueAsNumber;
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? 1
                : event.key === "PageDown"
                  ? value + 1 / labels.length
                  : event.key === "PageUp"
                    ? value - 1 / labels.length
                    : event.key === "ArrowRight" || event.key === "ArrowUp"
                      ? value + 1 / 65
                      : event.key === "ArrowLeft" || event.key === "ArrowDown"
                        ? value - 1 / 65
                        : null;
          if (next !== null) {
            event.preventDefault();
            seek(clamp(next));
          }
        }}
      />
      <i className="chapter-cursor" aria-hidden="true" />
      <i className="chapter-cursor chapter-cursor-ghost" aria-hidden="true" />
    </div>
  );
});
