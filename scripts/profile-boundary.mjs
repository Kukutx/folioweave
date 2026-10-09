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

export function resolveBoundaryTarget(root, env = process.env) {
  if (env.BOUNDARY_TARGET) return env.BOUNDARY_TARGET;
  if (env.GITHUB_BASE_REF) return env.GITHUB_BASE_REF;
  if (env.GITHUB_REF_NAME) return env.GITHUB_REF_NAME;
  // Vercel checks the deployed commit out under its own local branch name, so
  // Git alone would report `master` for a production build of `personal`.
  if (env.VERCEL_GIT_COMMIT_REF) return env.VERCEL_GIT_COMMIT_REF;

  if (!fs.existsSync(path.join(root, ".git"))) return "snapshot";
  return execFileSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

/**
 * Refs to try, in order, as the tree the working tree is compared with.
 *
 * The personal tree is always measured against main, including inside a pull
 * request whose base is personal: compared with its own base, a main sync
 * would be reported as reusable changes that exist only on personal.
 */
export function sharedBaseCandidates({
  personal,
  core,
  branch,
  env = process.env,
}) {
  const candidates = [];
  if (env.BOUNDARY_SHARED_BASE) candidates.push(env.BOUNDARY_SHARED_BASE);
  if (personal) candidates.push("origin/main", "main");
  else {
    if (env.GITHUB_BASE_REF)
      candidates.push(`origin/${env.GITHUB_BASE_REF}`, env.GITHUB_BASE_REF);
    if (core && branch) candidates.push(`origin/${branch}`, branch);
    else candidates.push("develop", "origin/develop", "main", "origin/main");
  }
  return [...new Set(candidates)];
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
  const core =
    policy.coreBranches.includes(targetBranch) ||
    (targetBranch === "snapshot" && canonicalSnapshot);
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
