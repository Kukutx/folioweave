#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  loadCatalog,
  resolveExtensions,
  implementationRoot,
} from "../src/core/extensions.mjs";
import { updateProfile } from "./profile-edit.mjs";
import { prepareContent, checkGeneratedContent } from "./content-build.mjs";
import {
  assertProfilePublicationAllowed,
  loadBranchPolicy,
  resolveBoundaryTarget,
} from "./profile-boundary.mjs";
import { scaffoldTemplate } from "./template-scaffold.mjs";

const root = implementationRoot;
const args = process.argv.slice(2);
const json = args.includes("--json");
const dryRun = args.includes("--dry-run");
let options;
const positional = [];
const help = `FolioWeave\n\n  npm run folio -- templates\n  npm run folio -- template use <id> [--options file.json] [--dry-run]\n  npm run folio -- template create <id>\n  npm run folio -- plugins\n  npm run folio -- plugin enable <id> [--options file.json] [--dry-run]\n  npm run folio -- plugin disable <id> [--dry-run]\n  npm run folio -- doctor [--json]\n  npm run folio -- setup\n\nTemplate switching retains author content and settings. Stop the development server before changing extensions; restart it afterward.\n`;

try {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--options") {
      if (!args[index + 1] || args[index + 1].startsWith("--"))
        throw new Error("--options needs a JSON filename");
      options = args[++index];
    } else if (["--json", "--dry-run"].includes(arg)) continue;
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else positional.push(arg);
  }
  const [command, action, id] = positional;
  if (positional.length > 3) throw new Error("Too many arguments");
  const edits =
    (command === "template" && action === "use") ||
    (command === "plugin" && ["enable", "disable"].includes(action));
  if (dryRun && !edits)
    throw new Error(
      "--dry-run is only supported for template use and plugin enable/disable",
    );
  if (
    options &&
    !(
      (command === "template" && action === "use") ||
      (command === "plugin" && action === "enable")
    )
  )
    throw new Error(
      "--options is only supported for template use and plugin enable",
    );
  if (json && !["templates", "plugins", "doctor"].includes(command))
    throw new Error(
      "--json is only supported for templates, plugins and doctor",
    );
  if (!command || command === "help") console.log(help);
  else if (command === "setup" && !action) {
    const child = spawnSync(
      process.execPath,
      [path.join(root, "scripts/personalize.mjs")],
      { cwd: root, stdio: "inherit" },
    );
    process.exitCode = child.status ?? 1;
  } else if (command === "template" && action === "create" && id) {
    if (dryRun) throw new Error("template create does not support --dry-run");
    if (resolveBoundaryTarget(root) === loadBranchPolicy(root).personalBranch)
      throw new Error(
        "Template source is shared implementation. Create it on a feature branch from develop, then promote through main before personal.",
      );
    await scaffoldTemplate(root, id);
    console.log(
      `Created src/templates/${id}. See docs/TEMPLATES.md for the integration contract.`,
    );
  } else {
    const catalog = loadCatalog(root);
    const profile = JSON.parse(
      await fs.readFile(path.join(root, "portfolio.json"), "utf8"),
    );
    if (["templates", "plugins"].includes(command) && !action) {
      const entries = catalog[command].map((item) => ({
        id: item.id,
        name: item.name,
        version: item.version,
        active:
          command === "templates"
            ? item.id === (profile.template?.id ?? "classic")
            : Boolean(profile.plugins?.[item.id]?.enabled),
        description: item.description,
      }));
      if (json) console.log(JSON.stringify(entries, null, 2));
      else
        entries.forEach((item) =>
          console.log(
            `${item.active ? "*" : " "} ${item.id} (${item.version}) — ${item.description}`,
          ),
        );
    } else if (command === "doctor" && !action) {
      const resolved = resolveExtensions(profile, catalog);
      assertProfilePublicationAllowed(root, profile);
      const prepared = await prepareContent(root, profile);
      await checkGeneratedContent(prepared, root);
      const report = {
        ok: true,
        template: resolved.template.id,
        plugins: resolved.plugins.map((plugin) => plugin.id),
        routes: prepared.routes.length,
        assets: Object.keys(prepared.media).length,
        notes: resolved.plugins.some((plugin) => plugin.id === "comments")
          ? [
              "Giscus repository access and app installation must be configured on GitHub; doctor validates local configuration only.",
            ]
          : [],
      };
      console.log(
        json
          ? JSON.stringify(report, null, 2)
          : `Configuration and publication are current. Template: ${report.template}; plugins: ${report.plugins.join(", ") || "none"}.\n${report.notes.join("\n")}`,
      );
    } else if (
      ((command === "template" && action === "use") ||
        (command === "plugin" && ["enable", "disable"].includes(action))) &&
      id
    ) {
      const values = options
        ? JSON.parse(await fs.readFile(path.resolve(root, options), "utf8"))
        : undefined;
      await updateProfile(
        root,
        (candidate) => {
          if (command === "template") {
            if (!catalog.templates.some((item) => item.id === id))
              throw new Error(`Unknown template: ${id}`);
            candidate.template = {
              id,
              settings: candidate.template?.settings ?? {},
            };
            if (values !== undefined) candidate.template.settings[id] = values;
          } else {
            if (
              !catalog.plugins.some((item) => item.id === id) &&
              !(action === "disable" && candidate.plugins?.[id])
            )
              throw new Error(`Unknown plugin: ${id}`);
            candidate.plugins ??= {};
            candidate.plugins[id] = {
              ...candidate.plugins[id],
              enabled: action === "enable",
              ...(values !== undefined ? { options: values } : {}),
            };
          }
          return candidate;
        },
        { dryRun },
      );
      console.log(
        dryRun
          ? "Configuration is valid; no files changed."
          : "Configuration and generated publication updated. Restart development or rebuild before deployment.",
      );
    } else throw new Error(help);
  }
} catch (error) {
  console.error(
    json ? JSON.stringify({ ok: false, error: error.message }) : error.message,
  );
  process.exitCode = 1;
}
