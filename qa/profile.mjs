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
