import fs from "node:fs/promises";
import path from "node:path";
import { check } from "prettier";

const root = path.resolve("src");
const failures = [];
const results = [];
const keyframeOwners = new Map();
const faceOwners = new Map();

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(absolute);
  }
  return files;
}

function register(owners, value, file) {
  const files = owners.get(value) ?? [];
  files.push(file);
  owners.set(value, files);
}

for (const file of await walk(root)) {
  const css = await fs.readFile(file, "utf8");
  const relative = path.relative(process.cwd(), file).replaceAll("\\", "/");
  if (!(await check(css, { filepath: file }))) failures.push({ kind: "format", name: "Readable CSS source required; run format:styles", files: [relative] });
  const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]);
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => {
    const body = match[1];
    const family = body.match(/font-family\s*:\s*([^;]+)/i)?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
    const style = body.match(/font-style\s*:\s*([^;]+)/i)?.[1]?.trim() ?? "normal";
    const weight = body.match(/font-weight\s*:\s*([^;]+)/i)?.[1]?.trim() ?? "normal";
    return family ? `${family}|${style}|${weight}` : "";
  }).filter(Boolean);
  for (const name of keyframes) register(keyframeOwners, name, relative);
  for (const face of faces) register(faceOwners, face, relative);
  results.push({
    file: relative,
    keyframes: keyframes.length,
    fontFaces: faces.length,
  });
}

for (const [name, files] of keyframeOwners) {
  if (files.length > 1) failures.push({ kind: "keyframes", name, files });
}
for (const [name, files] of faceOwners) {
  if (files.length > 1) failures.push({ kind: "font-face", name, files });
}

const report = {
  checkedFiles: results.length,
  duplicateDefinitions: failures.length,
  failures,
  results,
};
await fs.writeFile("qa/css-contract-report.json", JSON.stringify(report, null, 2));

if (failures.length) {
  console.error("CSS contract failed:");
  for (const failure of failures) {
    console.error(`  ${failure.kind} ${failure.name}: ${failure.files.join(", ")}`);
  }
  process.exitCode = 1;
} else {
  console.log(`CSS contract OK — ${results.length} CSS files checked globally; no duplicate keyframes or font faces.`);
}
