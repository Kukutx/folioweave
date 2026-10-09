import fs from "node:fs";
import path from "node:path";

export const qaTempRoot = path.resolve(
  import.meta.dirname,
  `../.generated/qa-temp-${process.pid}`,
);
fs.mkdirSync(qaTempRoot, { recursive: true });
process.on("exit", () => {
  try {
    fs.rmdirSync(qaTempRoot);
  } catch {
    /* other owned tests may still be running */
  }
});
