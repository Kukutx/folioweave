import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

function existing(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate));
}

function findOnPath(commands) {
  const locator = process.platform === "win32" ? "where" : "which";
  for (const command of commands) {
    try {
      const output = execFileSync(locator, [command], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean);
      const match = existing(output);
      if (match) return match;
    } catch {
      // Try the next browser command.
    }
  }
  return undefined;
}

export function resolveChromePath() {
  if (process.env.CHROME_PATH) {
    const explicit = path.resolve(process.env.CHROME_PATH);
    if (fs.existsSync(explicit)) return explicit;
    throw new Error(`CHROME_PATH does not exist: ${explicit}`);
  }

  const candidates = [];
  if (process.platform === "win32") {
    for (const root of [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ]) {
      if (!root) continue;
      candidates.push(
        path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(root, "Chromium", "Application", "chrome.exe"),
      );
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
      "/usr/bin/microsoft-edge-stable",
    );
  }

  const direct = existing(candidates);
  if (direct) return direct;

  const fromPath = findOnPath([
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "msedge",
    "microsoft-edge",
  ]);
  if (fromPath) return fromPath;

  throw new Error(
    "No Chrome/Chromium browser was found. Install Chrome/Chromium or set CHROME_PATH.",
  );
}

export function cleanupPlaywrightProcesses() {
  if (process.platform !== "win32") return;
  const script = [
    "$items = Get-CimInstance Win32_Process | Where-Object {",
    "  $_.Name -match 'chrome|msedge' -and",
    "  $_.CommandLine -match 'playwright_chromiumdev_profile'",
    "}",
    "foreach ($item in $items) {",
    "  Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue",
    "}",
  ].join("; ");
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
      stdio: "ignore",
    });
  } catch {
    // Best-effort cleanup for orphaned Playwright Chrome helpers on Windows.
  }
}
