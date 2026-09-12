import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";

// This session deliberately lives outside the child runner's ownership tree.
const sentinel = await chromium.launch({
  executablePath: resolveChromePath(),
  headless: true,
});
try {
  const page = await sentinel.newPage();
  await page.setContent("<h1>Independent browser session</h1>");
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["qa/run-with-server.mjs", "qa:css"],
      { stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Child QA failed: ${code}`)),
    );
  });
  assert.equal(sentinel.isConnected(), true);
  assert.equal(
    await page.locator("h1").innerText(),
    "Independent browser session",
  );
  await fs.writeFile(
    "qa/browser-ownership-report.json",
    JSON.stringify({ independentSessionSurvived: true }),
  );
  console.log(
    "PASS QA runner leaves independently owned browser sessions alive",
  );
} finally {
  await sentinel.close();
}
