import assert from "node:assert/strict";
import fs from "node:fs";

/** A sandbox profile changes test expectations, never the author's profile. */
export function loadQaProfile() {
  return JSON.parse(
    fs.readFileSync(
      process.env.QA_PROFILE_PATH ||
        new URL("../portfolio.json", import.meta.url),
      "utf8",
    ),
  );
}

/**
 * The first photograph card, or null when the profile publishes none.
 *
 * Whether the gallery exists is decided by the profile, not by the page: a
 * suite that only looked for the card would skip every gallery assertion, and
 * still report a pass, the day its label changes.
 */
export async function firstPhotograph(page, profile = loadQaProfile()) {
  const expected = profile.features.photography
    ? profile.photography.images.length
    : 0;
  const photo = page.getByRole("button", {
    name: "Open photograph 1 of",
    exact: false,
  });
  const found = await photo.count();
  assert.equal(
    found > 0,
    expected > 0,
    `the profile publishes ${expected} photographs but the page has ${found ? "a" : "no"} first photograph card`,
  );
  return found ? photo : null;
}
