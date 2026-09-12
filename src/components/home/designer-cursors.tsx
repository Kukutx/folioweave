"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  type MotionValue,
} from "framer-motion";
import { useEffect, useState } from "react";
import { useMotionActivity } from "@/hooks/use-motion-activity";
import { siteConfig } from "@/config/site";

function Pointer({
  x,
  y,
  color,
  name,
  isAnimated = false,
  showName = true,
}: {
  x: number | MotionValue<number>;
  y: number | MotionValue<number>;
  color: string;
  name: string;
  isAnimated?: boolean;
  showName?: boolean;
}) {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        x,
        y,
        pointerEvents: "none",
        zIndex: "var(--layer-decoration)",
        transition: isAnimated
          ? "transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)"
          : "none",
        willChange: "transform",
      }}
    >
      <svg
        width="18"
        height="24"
        viewBox="0 0 18 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <path
          d="M0 0L6.77143 22.2286L9.68571 12.5143L18 9.68571L0 0Z"
          fill={color}
        />
      </svg>
      {showName && (
        <div
          style={{
            background: color,
            padding: "4px 8px",
            borderRadius: "0 4px 4px 4px",
            marginTop: 4,
            marginLeft: 4,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 4px rgba(0,0,0,.2)",
          }}
        >
          {name}
        </div>
      )}
    </motion.div>
  );
}
export function DesignerCursors() {
  type SelectionRect = {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  type DesignerState = {
    x: number;
    y: number;
    targetRect: SelectionRect | null;
    elementLabel: string;
  };

  const userX = useMotionValue(-100);
  const userY = useMotionValue(-100);
  const [designer, setDesigner] = useState<DesignerState>({
    x: 100,
    y: 260,
    targetRect: null,
    elementLabel: "",
  });
  const [phase, setPhase] = useState(0);
  const { active: visible } = useMotionActivity(".hero-grid", {
    finePointer: true,
  });

  useEffect(() => {
    if (!visible) return;
    const positionFrame = window.requestAnimationFrame(() => {
      setDesigner((current) => ({
        ...current,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }));
    });
    const mouse = (event: MouseEvent) => {
      userX.set(event.clientX);
      userY.set(event.clientY);
    };
    window.addEventListener("mousemove", mouse);
    return () => {
      window.cancelAnimationFrame(positionFrame);
      window.removeEventListener("mousemove", mouse);
    };
  }, [visible, userX, userY]);

  useEffect(() => {
    if (!visible) return;
    const timers: number[] = [];
    const later = (fn: () => void, delay: number) => {
      const timer = window.setTimeout(fn, delay);
      timers.push(timer);
      return timer;
    };

    const run = () => {
      let target: HTMLElement | null = null;
      let label = "Text";
      if (phase === 0) {
        target = document.querySelector<HTMLElement>(".hero-bio p");
      } else if (phase === 1) {
        target = document.querySelector<HTMLElement>(".profile-portrait-card");
        label = "Image";
        if (!target) {
          setPhase(2);
          return;
        }
      } else {
        const selectors = [".hero-title", ".hero-bio p"];
        target = document.querySelector<HTMLElement>(
          selectors[Math.floor(Math.random() * selectors.length)],
        );
      }
      if (!target) {
        later(run, 1000);
        return;
      }

      const rect = target.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX;
      const right = rect.right + window.scrollX;
      const bottom = rect.bottom + window.scrollY;
      setDesigner((current) => ({
        ...current,
        x: left + 10,
        y: top + rect.height / 2,
        targetRect: null,
        elementLabel: label,
      }));

      later(() => {
        setDesigner((current) => ({
          ...current,
          x: right - 10,
          y: bottom - rect.height / 2,
          targetRect: { top, left, width: rect.width, height: rect.height },
          elementLabel: label,
        }));

        if (phase === 0) {
          later(() => {
            setDesigner((current) => ({ ...current, targetRect: null }));
            setPhase(1);
          }, 2000);
        } else if (phase === 1) {
          later(() => {
            setDesigner((current) => ({ ...current, targetRect: null }));
            setPhase(2);
          }, 2500);
        } else {
          later(() => {
            setDesigner((current) => ({ ...current, targetRect: null }));
            later(() => setPhase(0), 2000);
          }, 2000);
        }
      }, 800);
    };

    later(run, 1000);
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase, visible]);

  if (!visible) return null;
  return (
    <>
      <div
        aria-hidden="true"
        data-designer-overlay
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: "var(--layer-decoration)",
        }}
      >
        <AnimatePresence>
          {designer.targetRect && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                top: designer.targetRect.top,
                left: designer.targetRect.left,
                width: designer.targetRect.width,
                height: designer.targetRect.height,
                border: "2px solid #00D1FF",
                backgroundColor: "rgba(0, 209, 255, 0.15)",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -24,
                  left: -2,
                  background: "#00D1FF",
                  color: "white",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 6px",
                  borderRadius: "2px 2px 2px 0",
                }}
              >
                {designer.elementLabel || "Element"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Pointer
          x={designer.x}
          y={designer.y}
          color="#00D1FF"
          name={siteConfig.identity.name}
          isAnimated
        />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: "var(--layer-pointer)",
        }}
      >
        <Pointer x={userX} y={userY} color="#E23744" name="You" />
      </div>
    </>
  );
}
