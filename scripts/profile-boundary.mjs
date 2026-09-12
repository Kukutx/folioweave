import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

export function loadBranchPolicy(root) {
  return readJson(path.join(root, "governance", "branch-policy.json"));
}

export function resolveBoundaryTarget(root) {
  if (process.env.BOUNDARY_TARGET) return process.env.BOUNDARY_TARGET;
  if (process.env.GITHUB_BASE_REF) return process.env.GITHUB_BASE_REF;
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;

  if (!fs.existsSync(path.join(root, ".git"))) return "snapshot";
  return execFileSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

export function evaluateProfileBoundary(
  root,
  portfolio,
  { targetBranch = resolveBoundaryTarget(root) } = {},
) {
  const policy = loadBranchPolicy(root);
  const demoPortfolio = readJson(path.join(root, policy.demoProfile));
  const hasGitMetadata = fs.existsSync(path.join(root, ".git"));
  const canonicalSnapshot =
    !hasGitMetadata && isDeepStrictEqual(portfolio, demoPortfolio);
  const core = policy.coreBranches.includes(targetBranch) || canonicalSnapshot;
  const personal = targetBranch === policy.personalBranch;
  const errors = [];

  if (core) {
    if (portfolio.features?.demoRoutes !== true) {
      errors.push(
        `${targetBranch} requires features.demoRoutes=true in ${policy.profileConfig}.`,
      );
    }
    if (!isDeepStrictEqual(portfolio, demoPortfolio)) {
      errors.push(
        `${targetBranch} requires ${policy.profileConfig} to match ${policy.demoProfile}.`,
      );
    }
  } else if (personal) {
    if (portfolio.features?.demoRoutes !== false) {
      errors.push(
        `${policy.personalBranch} requires features.demoRoutes=false; refusing to publish the demo profile over the personal site.`,
      );
    }
    if (isDeepStrictEqual(portfolio, demoPortfolio)) {
      errors.push(
        `${policy.personalBranch} cannot publish the canonical demo profile from ${policy.demoProfile}.`,
      );
    }
  }

  return {
    policy,
    demoPortfolio,
    targetBranch,
    core,
    personal,
    errors,
  };
}

export function assertProfilePublicationAllowed(root, portfolio, options) {
  const result = evaluateProfileBoundary(root, portfolio, options);
  if (!result.errors.length) return result;

  throw new Error(
    `Profile publication blocked for ${result.targetBranch || "detached"}:\n` +
      result.errors.map((error) => `- ${error}`).join("\n"),
  );
}
