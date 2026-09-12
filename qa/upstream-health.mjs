import assert from "node:assert/strict";
import { loadQaProfile } from "./profile.mjs";

// Explicit operator diagnostic, not a deterministic UI regression gate.
const response = await fetch(
  `${process.env.BASE_URL || "http://127.0.0.1:4181"}/api/weather`,
);
const enabled = loadQaProfile().features.weather;
assert.equal(
  response.status,
  enabled ? 200 : 404,
  "Live weather upstream is unavailable",
);
const data = await response.json();
if (enabled)
  assert.ok(data.status === "fresh" && Number.isFinite(data.temperature));
console.log("Live weather endpoint healthy");
