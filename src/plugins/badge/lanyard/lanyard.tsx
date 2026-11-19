"use client";

import { useEffect, useRef, type RefObject } from "react";
import { mountLanyard, type LanyardScene, type LanyardSettings } from "./engine";
import styles from "./lanyard.module.css";

/** The lanyard scene, filling its parent. Settings may change while mounted;
 * `sceneRef` exposes the mounted scene (null without WebGL); `onMiss` hears
 * taps beside the cards. */
export function Lanyard({
  settings,
  sceneRef,
  onMiss,
  className = "",
}: {
  settings: LanyardSettings;
  sceneRef?: RefObject<LanyardScene | null>;
  onMiss?: () => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  const missRef = useRef(onMiss);
  const mounted = useRef<LanyardScene | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
    missRef.current = onMiss;
    mounted.current?.apply();
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = mountLanyard(
      container,
      () => settingsRef.current,
      styles.canvas,
      () => missRef.current?.(),
    );
    mounted.current = scene;
    if (sceneRef) sceneRef.current = scene;
    return () => {
      mounted.current = null;
      if (sceneRef) sceneRef.current = null;
      scene?.dispose();
    };
  }, [sceneRef]);

  return <div ref={containerRef} className={`${styles.lanyard} ${className}`.trim()} />;
}
