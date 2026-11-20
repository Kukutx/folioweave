"use client";

// The photographs on the bank. Each is a link to the picture itself; with JavaScript it opens over the water instead,
// in a modal dialog (Escape or Close, the arrow keys or Previous and Next to move along, focus back where it was).

import { useCallback, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import g from "./gallery.module.css";

export type Photo = { src: string; alt: string; width?: number; height?: number };

export function Photos({
  photos,
  labels,
}: {
  photos: Photo[];
  labels: { close: string; previous: string; next: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const count = photos.length;
  const step = useCallback((by: number) => setIndex((i) => (i === null ? i : (i + by + count) % count)), [count]);

  const open = (event: MouseEvent<HTMLAnchorElement>, i: number) => {
    const d = dialog.current;
    if (!d?.showModal || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setIndex(i);
    d.showModal();
  };
  const keys = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowLeft") step(-1);
    else if (event.key === "ArrowRight") step(1);
    else return;
    event.preventDefault();
  };
  const photo = index === null ? null : photos[index];

  return (
    <>
      <ul className={g.photos}>
        {photos.map((item, i) => (
          <li key={item.src} className={g.item}>
            <a className={g.photo} href={item.src} onClick={(event) => open(event, i)}>
              <img
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                loading={i < 3 ? "eager" : "lazy"}
                decoding="async"
              />
            </a>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        className={g.viewer}
        aria-label={photo?.alt}
        onClose={() => setIndex(null)}
        onKeyDown={keys}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        {photo && (
          <figure key={photo.src} className={g.figure}>
            <img className={g.large} src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} />
            <figcaption className={g.count}>
              {index! + 1} / {count}
            </figcaption>
          </figure>
        )}
        <div className={g.controls}>
          {count > 1 && (
            <>
              <button type="button" onClick={() => step(-1)}>
                {labels.previous}
              </button>
              <button type="button" onClick={() => step(1)}>
                {labels.next}
              </button>
            </>
          )}
          <button type="button" className={g.close} onClick={() => dialog.current?.close()} autoFocus>
            {labels.close}
          </button>
        </div>
      </dialog>
    </>
  );
}
