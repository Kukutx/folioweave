import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let ref = "main";
let destinationArg = null;

for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === "--ref") {
    ref = args[++index];
    if (!ref) throw new Error("--ref requires a Git ref.");
  } else if (!destinationArg) {
    destinationArg = arg;
  } else {
    throw new Error(`Unexpected argument: ${arg}`);
  }
}

if (!destinationArg) {
  console.error(
    "Usage: npm run export:public -- <empty-destination> [--ref <git-ref>]",
  );
  process.exit(2);
}

function gitBuffer(...gitArgs) {
  return execFileSync("git", gitArgs, {
    cwd: root,
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
}

function gitText(...gitArgs) {
  return gitBuffer(...gitArgs).toString("utf8");
}

const commit = gitText("rev-parse", "--verify", `${ref}^{commit}`).trim();
const policy = JSON.parse(gitText("show", `${ref}:governance/branch-policy.json`));
const profile = JSON.parse(gitText("show", `${ref}:${policy.profileConfig}`));
const demo = JSON.parse(gitText("show", `${ref}:${policy.demoProfile}`));

if (!isDeepStrictEqual(profile, demo)) {
  throw new Error(
    `${ref} is not a canonical reusable profile: ${policy.profileConfig} does not match ${policy.demoProfile}.`,
  );
}

const files = gitText("ls-tree", "-r", "-z", "--name-only", ref)
  .split("\0")
  .filter(Boolean);

function isPersonalOnly(file) {
  if (policy.sharedExceptions.includes(file)) return false;
  return policy.personalOnlyPrefixes.some((prefix) => file.startsWith(prefix));
}

const forbiddenName = /(^|\/)(?:\.env(?:\.|$)|\.vercel(?:\/|$)|\.personal-assets-source(?:\/|$)|[^/]+\.(?:pem|key|p12|pfx))/i;
const localArtifact = /^(?:\.generated\/|qa\/screens\/|qa\/static-home\/)/;

const forbidden = files.filter(
  (file) => isPersonalOnly(file) || forbiddenName.test(file) || localArtifact.test(file),
);

if (forbidden.length) {
  throw new Error(
    `Public export blocked by private/local paths:\n${forbidden.map((file) => `- ${file}`).join("\n")}`,
  );
}

const destination = path.resolve(process.cwd(), destinationArg);
const relativeToRoot = path.relative(root, destination);
if (
  destination === root ||
  (!relativeToRoot.startsWith("..") && !path.isAbsolute(relativeToRoot))
) {
  throw new Error("Public export destination must be outside the source repository.");
}
if (fs.existsSync(destination)) {
  throw new Error(`Destination already exists: ${destination}`);
}

const temporary = `${destination}.tmp-${process.pid}`;
fs.rmSync(temporary, { recursive: true, force: true });
fs.mkdirSync(temporary, { recursive: true });

try {
  for (const file of files) {
    const target = path.join(temporary, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, gitBuffer("show", `${ref}:${file}`));
  }
  fs.renameSync(temporary, destination);
} catch (error) {
  fs.rmSync(temporary, { recursive: true, force: true });
  throw error;
}

console.log(`Public snapshot exported from ${ref} (${commit})`);
console.log(`Files: ${files.length}`);
console.log(`Destination: ${destination}`);
console.log("No .git history was copied. Review media/licensing before creating a public remote.");
