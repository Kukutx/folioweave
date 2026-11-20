// FolioWeave Studio: the template and plugin CLI as a local web page.
//
//   npm run studio [-- --port <n>]
//
// Lists the templates as a gallery (personal sites and stores), opens a live
// preview of the author's own content in any of them (in a disposable sandbox;
// see template-preview.mjs), switches the template and turns plugins on and
// off through the same validated profile update the CLI uses. It listens on
// 127.0.0.1 only, and every change needs this run's token and same-origin
// request, so other sites in the browser cannot drive it.
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import {
  implementationRoot as root,
  loadCatalog,
  OPTIONAL_BLOCKS,
  profileValue,
} from "../src/core/extensions.mjs";
import { updateProfile } from "./profile-edit.mjs";
import { startPreview } from "./template-preview.mjs";

const token = randomBytes(24).toString("hex");
const portArgument = process.argv.indexOf("--port");
const port = portArgument > 0 ? Number(process.argv[portArgument + 1]) : 4100;
const assets = path.join(root, "scripts/studio");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

/** One preview at a time: each is a full development server. */
let preview = null;
let previewError = null;

async function readProfile() {
  return JSON.parse(
    await fs.readFile(path.join(root, "portfolio.json"), "utf8"),
  );
}

async function readSample(id) {
  const file = path.join(root, "src/templates", id, "sample.json");
  return JSON.parse(await fs.readFile(file, "utf8").catch(() => "null"));
}

/** Optional blocks a template needs that the profile does not have yet. */
function missingBlocks(template, profile) {
  return (template.requires ?? []).filter(
    (block) =>
      OPTIONAL_BLOCKS.includes(block) && profileValue(profile, block) === undefined,
  );
}

async function state() {
  const profile = await readProfile();
  const catalog = loadCatalog(root);
  const current = profile.template?.id ?? "classic";
  const templates = await Promise.all(
    catalog.templates.map(async (template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      translations: template.translations ?? {},
      category: template.category ?? "personal",
      current: template.id === current,
      preview: template.preview ? `/template-preview/${template.id}` : null,
      missing: missingBlocks(template, profile),
      sample: (await readSample(template.id)) !== null,
    })),
  );
  return {
    templates,
    plugins: catalog.plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      translations: plugin.translations ?? {},
      enabled: Boolean(profile.plugins?.[plugin.id]?.enabled),
      page: plugin.page ? `/tools/${plugin.page.path}` : null,
    })),
    preview: preview
      ? { template: preview.template, url: preview.url, ready: preview.isReady }
      : null,
    previewError,
  };
}

/** Deep-merge only what the profile lacks, so author data always wins. */
function fillMissing(profile, sample) {
  if (!sample) return profile;
  const next = structuredClone(profile);
  for (const [key, value] of Object.entries(sample)) {
    if (key === "template") continue;
    if (next[key] === undefined) next[key] = value;
  }
  return next;
}

async function useTemplate(id, { withSample }) {
  const catalog = loadCatalog(root);
  const template = catalog.templates.find((item) => item.id === id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  const sample = withSample ? await readSample(id) : null;
  await updateProfile(root, (candidate) => {
    const profile = fillMissing(candidate, sample);
    const settings = profile.template?.settings ?? {};
    const sampleSettings = sample?.template?.settings?.[id];
    profile.template = {
      id,
      settings:
        sampleSettings && settings[id] === undefined
          ? { ...settings, [id]: sampleSettings }
          : settings,
    };
    const missing = missingBlocks(template, profile);
    if (missing.length)
      throw new Error(
        `${template.name} needs ${missing.join(", ")} in portfolio.json.`,
      );
    return profile;
  });
}

async function setPlugin(id, enabled) {
  const catalog = loadCatalog(root);
  if (!catalog.plugins.some((plugin) => plugin.id === id))
    throw new Error(`Unknown plugin: ${id}`);
  await updateProfile(root, (candidate) => {
    candidate.plugins ??= {};
    candidate.plugins[id] = { ...candidate.plugins[id], enabled };
    return candidate;
  });
}

async function openPreview(id) {
  const catalog = loadCatalog(root);
  const template = catalog.templates.find((item) => item.id === id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  await preview?.stop();
  preview = null;
  previewError = null;
  // The author's content wins; the template's sample only fills what it needs.
  const fills = (await readSample(id))
    ? [path.join(root, "src/templates", id, "sample.json")]
    : [];
  const started = await startPreview({ template: id, fills, quiet: true });
  preview = Object.assign(started, { isReady: false });
  started.ready
    .then(() => {
      if (preview === started) preview.isReady = true;
    })
    .catch((error) => {
      if (preview === started) previewError = error.message;
    });
}

function send(response, status, body, type = "application/json") {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  });
  response.end(
    typeof body === "string" || Buffer.isBuffer(body)
      ? body
      : JSON.stringify(body),
  );
}

async function readBody(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 10_000) throw new Error("Request too large");
  }
  return text ? JSON.parse(text) : {};
}

const origin = `http://127.0.0.1:${port}`;
const server = http.createServer(async (request, response) => {
  try {
    // Only this origin, by this name: blocks DNS rebinding.
    const host = request.headers.host;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`)
      return send(response, 421, { error: "Wrong host" });
    const url = new URL(request.url, `http://${host}`);
    if (request.method === "GET") {
      if (url.pathname === "/")
        return send(
          response,
          200,
          (await fs.readFile(path.join(assets, "index.html"), "utf8")).replace(
            "__STUDIO_TOKEN__",
            token,
          ),
          types[".html"],
        );
      if (/^\/(studio\.css|studio\.js)$/.test(url.pathname))
        return send(
          response,
          200,
          await fs.readFile(path.join(assets, url.pathname.slice(1))),
          types[path.extname(url.pathname)],
        );
      const image = url.pathname.match(
        /^\/template-preview\/([a-z][a-z0-9-]*)$/,
      );
      if (image) {
        const template = loadCatalog(root).templates.find(
          (item) => item.id === image[1],
        );
        if (!template?.preview)
          return send(response, 404, { error: "No preview" });
        return send(
          response,
          200,
          await fs.readFile(
            path.join(root, "src/templates", template.id, template.preview),
          ),
          types[path.extname(template.preview)],
        );
      }
      if (url.pathname === "/api/state")
        return send(response, 200, await state());
      return send(response, 404, { error: "Not found" });
    }
    if (request.method !== "POST")
      return send(response, 405, { error: "Method not allowed" });
    if (
      request.headers.origin !== `http://${host}` ||
      request.headers["x-studio-token"] !== token
    )
      return send(response, 403, { error: "Forbidden" });
    const body = await readBody(request);
    if (url.pathname === "/api/preview/stop") {
      await preview?.stop();
      preview = null;
      previewError = null;
      return send(response, 200, await state());
    }
    const action = url.pathname.match(
      /^\/api\/(template|plugin)\/([a-z][a-z0-9-]*)\/(use|preview|enable|disable)$/,
    );
    if (!action) return send(response, 404, { error: "Not found" });
    const [, kind, id, verb] = action;
    if (kind === "template" && verb === "use")
      await useTemplate(id, { withSample: body.withSample === true });
    else if (kind === "template" && verb === "preview") await openPreview(id);
    else if (kind === "plugin" && (verb === "enable" || verb === "disable"))
      await setPlugin(id, verb === "enable");
    else return send(response, 404, { error: "Not found" });
    return send(response, 200, await state());
  } catch (error) {
    return send(response, 400, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `FolioWeave Studio: ${origin}\nChanges to the template or plugins take effect after restarting npm run dev.\nStop with Ctrl+C.`,
  );
});

const shutdown = async () => {
  server.close();
  await preview?.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
