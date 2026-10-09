import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  preparePluginContracts,
  checkPluginContracts,
  schemaDefaults,
} from "../scripts/plugin-contracts.mjs";
import { qaTempRoot } from "./temp-directory.mjs";

const root = path.resolve(import.meta.dirname, "..");
test("explicit object defaults override property defaults", () => {
  assert.deepEqual(
    schemaDefaults({
      type: "object",
      properties: { enabled: { type: "boolean", default: false } },
      default: { enabled: true },
    }),
    { enabled: true },
  );
});
test("checked-in plugin contracts match the schema", async () => {
  await checkPluginContracts(root);
});

test("changed and invalid defaults cannot silently drift from runtime contracts", async () => {
  const fixture = await fs.mkdtemp(path.join(qaTempRoot, "contracts-"));
  try {
    for (const entry of [
      "src/plugins",
      "src/templates",
      "src/core/extension-points.json",
    ]) {
      await fs.mkdir(path.dirname(path.join(fixture, entry)), {
        recursive: true,
      });
      await fs.cp(path.join(root, entry), path.join(fixture, entry), {
        recursive: true,
      });
    }
    const file = path.join(fixture, "src/plugins/music/manifest.json");
    const manifest = JSON.parse(await fs.readFile(file, "utf8"));
    manifest.optionsSchema.properties.volume.default = 0.35;
    await fs.writeFile(file, JSON.stringify(manifest));
    await assert.rejects(checkPluginContracts(fixture), /stale/);
    const outputs = await preparePluginContracts(fixture);
    assert.match(
      outputs.find(
        (output) => output.target === "src/plugins/music/options.generated.ts",
      ).contents,
      /volume: 0\.35/,
    );
    manifest.optionsSchema.properties.volume.default = 5;
    await fs.writeFile(file, JSON.stringify(manifest));
    await assert.rejects(preparePluginContracts(fixture), /volume/);
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
