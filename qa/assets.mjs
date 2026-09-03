import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve("qa/assets-manifest.json");
const publicRoot = path.resolve("public");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

const failures = [];
let exact = 0;

for (const asset of manifest.assets) {
  const filePath = path.join(publicRoot, asset.publicPath);
  try {
    const buffer = await fs.readFile(filePath);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    if (buffer.length !== asset.size || sha256 !== asset.sha256) {
      failures.push({
        type: "mismatch",
        publicPath: asset.publicPath,
        expectedSize: asset.size,
        actualSize: buffer.length,
        expectedSha256: asset.sha256,
        actualSha256: sha256,
      });
    } else {
      exact += 1;
    }
  } catch (error) {
    failures.push({
      type: "missing",
      publicPath: asset.publicPath,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

for (const publicPath of manifest.templateExtras ?? []) {
  try {
    await fs.access(path.join(publicRoot, publicPath));
  } catch {
    failures.push({ type: "missing-template-extra", publicPath });
  }
}

const summary = {
  expectedReferenceAssets: manifest.count,
  exactReferenceAssets: exact,
  templateExtras: (manifest.templateExtras ?? []).length,
  failures: failures.length,
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
