"use client";

import { useCallback, useEffect, useRef } from "react";

export function useManagedTimeouts() {
  const timers = useRef(new Set<number>());

  const clearAll = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current.clear();
  }, []);

  const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
    return timer;
  }, []);

  useEffect(() => clearAll, [clearAll]);

  return { scheduleTimeout, clearAll } as const;
}
