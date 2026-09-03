"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera as CameraIcon, Download } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useManagedTimeouts } from "@/hooks/use-managed-timeouts";

export function InstaxCamera({ onPrint }: { onPrint?: () => void }) {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false),
    [captured, setCaptured] = useState<string | null>(null),
    [printing, setPrinting] = useState(false),
    [flash, setFlash] = useState(false);
  const { scheduleTimeout } = useManagedTimeouts();
  const stop = useCallback((updateState = true) => {
    const s = video.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (video.current) video.current.srcObject = null;
    if (updateState) setStreaming(false);
  }, []);
  useEffect(() => () => stop(false), [stop]);
  const start = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");

      // Render the <video> before attaching MediaStream. The previous version
      // only rendered it after play(), leaving video.current null forever.
      setStreaming(true);
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );

      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });
      if (!video.current) {
        s.getTracks().forEach((track) => track.stop());
        throw new Error("camera video element unavailable");
      }
      video.current.srcObject = s;
      video.current.setAttribute("playsinline", "true");
      await video.current.play();
    } catch (error) {
      const e = error as DOMException;
      let text = "Unable to access camera. ";
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")
        text += "Please allow camera permissions in your browser settings.";
      else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError")
        text += "No camera found on this device.";
      else if (e.name === "NotReadableError" || e.name === "TrackStartError")
        text += "Camera is already in use by another application.";
      else text += "Please check your browser settings and try again.";
      stop();
      alert(text);
    }
  };
  const shoot = () => {
    if (!video.current || !canvas.current) return;
    setFlash(true);
    scheduleTimeout(() => setFlash(false), 400);
    const v = video.current,
      c = canvas.current,
      g = c.getContext("2d");
    if (!g) return;
    const size = Math.min(v.videoWidth, v.videoHeight),
      sx = (v.videoWidth - size) / 2,
      sy = (v.videoHeight - size) / 2;
    c.width = size;
    c.height = size;
    g.drawImage(v, sx, sy, size, size, 0, 0, size, size);
    const data = c.toDataURL("image/webp");
    scheduleTimeout(() => {
      setCaptured(data);
      stop();
      setPrinting(true);
      onPrint?.();
      scheduleTimeout(() => setPrinting(false), 3000);
    }, 100);
  };
  const download = () => {
    if (!captured) return;
    const out = document.createElement("canvas"),
      g = out.getContext("2d"),
      img = new Image();
    img.onload = () => {
      const w = img.width + 80,
        h = img.height + 160;
      out.width = w;
      out.height = h;
      if (!g) return;
      g.fillStyle = "#fff";
      g.fillRect(0, 0, w, h);
      g.drawImage(img, 40, 40);
      g.font = '24px "Caveat Portfolio", cursive';
      g.fillStyle = "#333";
      g.textAlign = "center";
      const d = new Date(),
        date = d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        time = d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      g.fillText(`${date} • ${time}`, w / 2, h - 50);
      const a = document.createElement("a");
      a.download = `clickedbyog-${Date.now()}.webp`;
      a.href = out.toDataURL("image/webp");
      a.click();
    };
    img.src = captured;
  };
  const keyboard = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !streaming && !captured) {
      e.preventDefault();
      start();
    }
  };
  return (
    <div className="instax-container instax-polaroid">
      <div className="instax-scaler">
        <div className="instax-wrapper">
          {flash &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: "100vw",
                  height: "100vh",
                  background: "#ffffff",
                  zIndex: 999999,
                  pointerEvents: "none",
                  animation: "flash 0.4s ease-out",
                  margin: 0,
                  padding: 0,
                }}
              />,
              document.body,
            )}
          <div
            className="camera"
            aria-label="Photorealistic illustration of a Polaroid camera"
          >
            <div className="top">
              <div className="flash" />
              <div className="timer" />
              <div className="sensor" />
              <div
                className={`lens ${!streaming && !captured ? "is-clickable" : ""}`}
                onClick={!streaming && !captured ? start : undefined}
                onKeyDown={keyboard}
                role={!streaming && !captured ? "button" : undefined}
                tabIndex={!streaming && !captured ? 0 : -1}
                aria-label="Start camera"
              >
                <div className="glass">
                  {!streaming && !captured && (
                    <div className="lens-label">
                      <CameraIcon size={30} color="#e5e5e5" strokeWidth={1.5} />
                      <span>TAP LENS</span>
                    </div>
                  )}
                  {streaming && (
                    <video
                      ref={video}
                      autoPlay
                      playsInline
                      className="lens-media"
                    />
                  )}
                  {captured && !streaming && (
                    <img src={captured} alt="Captured" className="lens-media" />
                  )}
                </div>
              </div>
              <button
                type="button"
                className={`shutter ${streaming ? "" : "disabled"}`}
                onClick={shoot}
                disabled={!streaming}
                aria-label="Take photo"
              >
                <span className="shutter-label">Click</span>
              </button>
              <div className="viewfinder">
                <div className="glass">
                  <div className="back" />
                </div>
              </div>
              <div className="toggle-container">
                <div className="toggle" />
              </div>
              <div className="power" />
              <div className="title" />
            </div>
            <div className="bottom">
              <div className="toggle-container">
                <div className="toggle">
                  <div className="handle" />
                </div>
              </div>
              <div className="printer" />
              <div className="instax-print-track">
                <AnimatePresence>
                  {captured && (
                    <PrintedPhoto captured={captured} printing={printing} />
                  )}
                </AnimatePresence>
              </div>
              <div className="labels">
                <div className="rainbow" />
                <div className="logo">Polaroid</div>
                <div className="type" />
              </div>
            </div>
          </div>
        </div>
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: captured ? 440 : 0 }}
          transition={{ duration: printing ? 3 : 0.5, ease: "linear" }}
        />
        <AnimatePresence>
          {captured && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: printing ? 3 : 0 }}
              className="instax-controls"
            >
              <button
                type="button"
                onClick={() => setCaptured(null)}
                className="instax-button instax-button-dark"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={download}
                className="instax-button"
              >
                Download <Download size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <canvas ref={canvas} style={{ display: "none" }} />
      </div>
    </div>
  );
}
function PrintedPhoto({
  captured,
  printing,
}: {
  captured: string;
  printing: boolean;
}) {
  const d = new Date();
  return (
    <motion.div
      className="printed-photo"
      initial={{ y: -290, x: "-50%", opacity: 1 }}
      animate={{ y: 128, x: "-50%", opacity: 1 }}
      transition={
        printing
          ? { duration: 2.9, ease: [0.22, 1, 0.36, 1] }
          : { duration: 0.25, ease: "easeOut" }
      }
      style={{
        position: "absolute",
        top: 0,
        left: "50%",
        background: "white",
        padding: "18px 18px 72px",
        borderRadius: 2,
        boxShadow: "0 10px 20px rgba(0,0,0,.15)",
        zIndex: 1,
        width: 240,
        transformOrigin: "top center",
        cursor: printing ? "default" : "pointer",
      }}
      whileHover={
        printing
          ? {}
          : {
              scale: 1.02,
              zIndex: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }
      }
    >
      <motion.div
        style={{
          width: "100%",
          aspectRatio: "1/1",
          background: "#111",
          overflow: "hidden",
          position: "relative",
        }}
        initial={{ filter: "brightness(0)" }}
        animate={{ filter: "brightness(1)" }}
        transition={{ duration: 2, delay: 0.5 }}
      >
        <img
          src={captured}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)",
          }}
        />
      </motion.div>
      <div
        style={{
          marginTop: 15,
          fontFamily: "var(--font-hand)",
          color: "#333",
          fontSize: "1.2rem",
          textAlign: "center",
        }}
      >
        {d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}{" "}
        •{" "}
        {d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </motion.div>
  );
}
