"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * The visitor's API key lives only in this browser's localStorage. Without
 * storage (private mode, blocked site data) it lives in memory for this
 * visit. Components read it as an external store, so server rendering and
 * hydration agree (no key on the server) and other tabs stay in sync.
 */

const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function read(slot: string | null): string {
  if (!slot) return "";
  if (memory.has(slot)) return memory.get(slot)!;
  try {
    return window.localStorage.getItem(slot) ?? "";
  } catch {
    return "";
  }
}

function write(slot: string, key: string) {
  try {
    if (key) window.localStorage.setItem(slot, key);
    else window.localStorage.removeItem(slot);
    memory.delete(slot);
  } catch {
    if (key) memory.set(slot, key);
    else memory.delete(slot);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const onServer = () => "";

/** The stored key for `slot` (none when null) and a setter; "" clears it. */
export function useApiKey(slot: string | null) {
  const key = useSyncExternalStore(subscribe, () => read(slot), onServer);
  const setKey = useCallback(
    (next: string) => {
      if (slot) write(slot, next.trim());
    },
    [slot],
  );
  return [key, setKey] as const;
}
