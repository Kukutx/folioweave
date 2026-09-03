"use client";

import { useCallback, useSyncExternalStore } from "react";

type Listener = () => void;
type MediaStore = {
  media: MediaQueryList;
  listeners: Set<Listener>;
  attached: boolean;
  notify: () => void;
};

const stores = new Map<string, MediaStore>();

function getStore(query: string) {
  if (typeof window === "undefined") return null;
  const existing = stores.get(query);
  if (existing) return existing;

  const media = window.matchMedia(query);
  const listeners = new Set<Listener>();
  const store: MediaStore = {
    media,
    listeners,
    attached: false,
    notify: () => listeners.forEach((listener) => listener()),
  };
  stores.set(query, store);
  return store;
}

function attach(store: MediaStore) {
  if (store.attached) return;
  store.media.addEventListener("change", store.notify);
  store.attached = true;
}

function detachIfIdle(store: MediaStore) {
  if (!store.attached || store.listeners.size > 0) return;
  store.media.removeEventListener("change", store.notify);
  store.attached = false;
}

function getSnapshot(query: string) {
  return getStore(query)?.media.matches ?? false;
}

export function useMediaQuery(
  query: string,
  { debounceMs = 0 }: { debounceMs?: number } = {},
) {
  const subscribe = useCallback(
    (listener: Listener) => {
      const store = getStore(query);
      if (!store) return () => {};
      attach(store);

      if (debounceMs <= 0) {
        store.listeners.add(listener);
        return () => {
          store.listeners.delete(listener);
          detachIfIdle(store);
        };
      }

      let timer = 0;
      const debounced = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(listener, debounceMs);
      };
      store.listeners.add(debounced);
      return () => {
        window.clearTimeout(timer);
        store.listeners.delete(debounced);
        detachIfIdle(store);
      };
    },
    [debounceMs, query],
  );

  const read = useCallback(() => getSnapshot(query), [query]);
  return useSyncExternalStore(subscribe, read, () => false);
}

export const mobileViewportQuery = "(max-width: 767px)";

export function useMobileViewport(options?: { debounceMs?: number }) {
  return useMediaQuery(mobileViewportQuery, options);
}
