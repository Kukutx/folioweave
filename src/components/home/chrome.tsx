"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { Moon, RefreshCw, Sun, Sunset, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { mailto, siteConfig } from "@/config/site";

type Weather = { icon: string; temperature: number | null };

const weatherIcons = {
  day: {
    0: "☀️",
    1: "🌤️",
    2: "⛅",
    3: "☁️",
    45: "🌫️",
    48: "🌫️",
    51: "🌦️",
    53: "🌦️",
    55: "🌧️",
    56: "🌨️",
    57: "🌨️",
    61: "🌧️",
    63: "🌧️",
    65: "⛈️",
    66: "🌨️",
    67: "🌨️",
    71: "🌨️",
    73: "❄️",
    75: "❄️",
    77: "🌨️",
    80: "🌦️",
    81: "🌧️",
    82: "⛈️",
    85: "🌨️",
    86: "❄️",
    95: "⛈️",
    96: "⛈️",
    99: "⛈️",
  },
  night: {
    0: "🌙",
    1: "🌙",
    2: "☁️",
    3: "☁️",
    45: "🌫️",
    48: "🌫️",
    51: "🌧️",
    53: "🌧️",
    55: "🌧️",
    56: "🌨️",
    57: "🌨️",
    61: "🌧️",
    63: "🌧️",
    65: "⛈️",
    66: "🌨️",
    67: "🌨️",
    71: "🌨️",
    73: "❄️",
    75: "❄️",
    77: "🌨️",
    80: "🌧️",
    81: "🌧️",
    82: "⛈️",
    85: "🌨️",
    86: "❄️",
    95: "⛈️",
    96: "⛈️",
    99: "⛈️",
  },
} as const;

export function TimeWeatherWidget() {
  const [time, setTime] = useState("");
  const [weather, setWeather] = useState<Weather>({
    icon: "⛅",
    temperature: null,
  });
  useEffect(() => {
    const tick = () =>
      setTime(
        new Intl.DateTimeFormat("en-US", {
          timeZone: siteConfig.location.timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/weather", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const mode = data.isDay ? "day" : "night";
        const code = Number(data.weatherCode) as keyof typeof weatherIcons.day;
        setWeather({
          icon: weatherIcons[mode][code] || (data.isDay ? "⛅" : "🌙"),
          temperature: Math.round(data.temperature),
        });
      })
      .catch(() => setWeather({ icon: "⛅", temperature: null }));
    return () => controller.abort();
  }, []);
  return (
    <div className="time-widget" style={{ fontSize: "0.75rem", opacity: 0.8 }}>
      <div
        className="time-pill"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(0,0,0,.05)",
          padding: "4px 10px",
          borderRadius: 20,
          border: "1px solid rgba(0,0,0,.05)",
          whiteSpace: "nowrap",
        }}
      >
        <span className="time-label">{time}</span>
        <span className="ist-label">{siteConfig.location.timeZoneLabel}</span>
        <span
          className="weather-label"
          aria-label={
            weather.temperature == null
              ? `${siteConfig.location.city} weather`
              : `${siteConfig.location.city} weather ${weather.temperature} degrees Celsius`
          }
        >
          <span aria-hidden>{weather.icon}</span>
          {weather.temperature !== null && <span>{weather.temperature}°</span>}
        </span>
      </div>
    </div>
  );
}

const buttonStyles = [
  ["cycle-btn-default", "Get in Touch"],
  ["cycle-btn-retro", "CONTACT.EXE"],
  ["cycle-btn-neo", "START_MAIL"],
  ["cycle-btn-old", "Send Mail..."],
  ["cycle-btn-glitch", "C0NTACT_N0W"],
  ["cycle-btn-glass", "Connect"],
  ["cycle-btn-clay", "Get in Touch"],
] as const;

export function ContactCycleButton({ compact = false }: { compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const x = useMotionValue(0),
    y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 320, damping: 28 }),
    sy = useSpring(y, { stiffness: 320, damping: 28 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hovered) return;
    const id = window.setInterval(
      () => setIndex((v) => (v + 1) % buttonStyles.length),
      250,
    );
    return () => clearInterval(id);
  }, [hovered]);
  const onMove = (e: React.MouseEvent) => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !ref.current
    )
      return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.4);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.4);
  };
  return (
    <motion.div
      ref={ref}
      className="cycle-btn-mobile-hide"
      onMouseMove={onMove}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{
        x: sx,
        y: sy,
        display: "inline-block",
        minWidth: compact ? 105 : 130,
        height: compact ? 32 : 42,
        position: "relative",
      }}
    >
      <a
        href={mailto(
          siteConfig.contact.email,
          siteConfig.contact.helloSubject,
        )}
        className={`cycle-btn ${compact ? "cycle-btn-compact" : ""} ${buttonStyles[index][0]}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setIndex(0);
        }}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {buttonStyles[index][1]}
      </a>
    </motion.div>
  );
}

function greetingForHour(hour: number): { message: string; icon: "sun" | "sunset" | "moon" } {
  if (hour >= 5 && hour < 12) {
    return {
      message: "Good morning! Start your day with some design inspiration.",
      icon: "sun",
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      message: "Good afternoon! Hope your day is going great.",
      icon: "sun",
    };
  }
  if (hour >= 17 && hour < 22) {
    return { message: "Good evening! Thanks for stopping by.", icon: "sunset" as const };
  }
  return {
    message: "Late night browsing? Me too. Enjoy the portfolio!",
    icon: "moon" as const,
  };
}

export function GreetingToast() {
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    icon: "sun" | "sunset" | "moon";
  }>({
    visible: false,
    message: "",
    icon: "sun",
  });
  useEffect(() => {
    const a = window.setTimeout(() => {
      const greeting = greetingForHour(new Date().getHours());
      setToast({ visible: true, ...greeting });
    }, 1500);
    const b = window.setTimeout(
      () => setToast((current) => ({ ...current, visible: false })),
      6500,
    );
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const { visible, message, icon } = toast;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -100, opacity: 0, x: "-50%" }}
          animate={{ y: 20, opacity: 1, x: "-50%" }}
          exit={{ y: -100, opacity: 0, x: "-50%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            position: "fixed",
            top: 80,
            left: "50%",
            zIndex: 19000,
            background: "rgba(255,255,255,.7)",
            backdropFilter: "blur(12px)",
            padding: "10px 20px",
            borderRadius: 30,
            boxShadow: "0 8px 32px rgba(0,0,0,.1)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid rgba(255,255,255,.4)",
            width: "max-content",
            maxWidth: "90vw",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,.05)",
              borderRadius: "50%",
              padding: 6,
            }}
          >
            {icon === "sun" ? (
              <Sun size={18} color="#666" />
            ) : icon === "sunset" ? (
              <Sunset size={18} color="#666" />
            ) : (
              <Moon size={18} color="#666" />
            )}
          </div>
          <span
            style={{
              fontSize: "0.9rem",
              fontWeight: 500,
              color: "#000",
              fontFamily: "Google Sans, sans-serif",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

async function connectivityPing() {
  try {
    await fetch(`/favicon-32x32.png?ping=${Date.now()}`, {
      cache: "no-store",
      mode: "no-cors",
    });
    return true;
  } catch {
    return false;
  }
}
export function OfflineScreen() {
  const [state, setState] = useState<"hidden" | "visible" | "leaving">(
    "hidden",
  );
  const [checking, setChecking] = useState(false);
  const restore = useCallback(() => {
    setState((current) => (current === "visible" ? "leaving" : current));
  }, []);

  useEffect(() => {
    if (state !== "leaving") return;
    const hideTimer = window.setTimeout(() => setState("hidden"), 1400);
    return () => clearTimeout(hideTimer);
  }, [state]);
  useEffect(() => {
    const off = () => setState("visible");
    if (!navigator.onLine) off();
    const on = async () => {
      if (await connectivityPing()) restore();
    };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, [restore]);
  useEffect(() => {
    if (state !== "visible") return;
    const id = window.setInterval(async () => {
      if (await connectivityPing()) restore();
    }, 4000);
    return () => clearInterval(id);
  }, [state, restore]);
  if (state === "hidden") return null;
  const leaving = state === "leaving";
  const retry = async () => {
    setChecking(true);
    if (await connectivityPing()) {
      location.reload();
      return;
    }
    setTimeout(() => setChecking(false), 600);
  };
  return (
    <div
      className={`offline-screen ${leaving ? "offline-leaving" : ""}`}
      role="alert"
    >
      <div className="offline-backdrop" aria-hidden />
      <div className="offline-content">
        <div className="offline-badge" aria-hidden>
          {leaving ? <Wifi size={26} /> : <WifiOff size={26} />}
        </div>
        <h1 className="offline-code" aria-hidden>
          4<span className="offline-zero">0</span>4
        </h1>
        <p className="offline-note" aria-hidden>
          {leaving ? "back online!" : "well, you're offline"}
        </p>
        <h2 className="offline-title">
          {leaving ? "Connection restored" : "No internet connection"}
        </h2>
        <p className="offline-message">
          {leaving
            ? "Taking you right back to the portfolio…"
            : "The portfolio will be right here once you reconnect — it checks automatically."}
        </p>
        {!leaving && (
          <button className="offline-retry" onClick={retry} disabled={checking}>
            <RefreshCw size={15} className={checking ? "offline-spin" : ""} />
            {checking ? "Checking…" : "Try again"}
          </button>
        )}
      </div>
    </div>
  );
}
