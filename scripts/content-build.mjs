import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  requireProfileBlocks,
  resolveExtensions,
  extensionOutputs,
} from "../src/core/extensions.mjs";
import {
  collectAssets,
  publishedPortfolio,
  validatePublicationLinks,
  validateContentLinks,
} from "../src/portfolio/content-policy.mjs";
import {
  loadMarkdownBlogPosts,
  normalizeCustomBlogPosts,
  publishedMarkdownBlogPosts,
  publishedCustomBlogPosts,
} from "../src/blog/content-core.mjs";
import { resolvePublishedRoutes } from "../src/portfolio/publication-policy.mjs";
import { taxonomyRoutes } from "../src/blog/taxonomy.mjs";

import { prepareContract } from "./generate-portfolio-contract.mjs";
import { commitGeneratedOutputs } from "./atomic-output.mjs";
import { assertProfilePublicationAllowed } from "./profile-boundary.mjs";
import { createProjectContext } from "./project-context.mjs";
import {
  assertProjectLease,
  withProjectWriteLock,
  readOptional,
} from "./project-lock.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export async function prepareContent(root = projectRoot, candidate) {
  root = path.resolve(root);
  const [profileSource, publicationSource] = await Promise.all([
    readOptional(path.join(root, "portfolio.json")),
    readOptional(path.join(root, ".generated/publication.json")),
  ]);
  const context = await createProjectContext(root);
  const read = async (name) =>
    JSON.parse(await fs.readFile(path.join(root, name), "utf8"));
  const config = candidate ?? JSON.parse(profileSource);
  const { validate } = context;
  if (!validate(config))
    throw new Error(`Invalid portfolio: ${JSON.stringify(validate.errors)}`);
  const extensions = resolveExtensions(config, context.catalog);
  requireProfileBlocks(config, extensions.template);
  const custom = normalizeCustomBlogPosts([
    ...(await read("src/blog/custom-posts.json")),
    ...(await read("src/demo/custom-posts.json")),
  ]);
  const { posts } = loadMarkdownBlogPosts({
    blogsDir: path.join(root, "content/blogs"),
    reservedSlugs: custom.map((post) => post.slug),
  });
  const livePosts = posts.filter((post) => !post.draft);
  const liveCustom = publishedCustomBlogPosts(
    custom,
    config.features.demoRoutes,
  );
  // Tag pages exist because posts carry tags; deriving them here also rejects
  // two tags that would collapse into one page.
  const blogRoutes = [
    ...[...livePosts, ...liveCustom].map((post) => post.href),
    ...taxonomyRoutes([...livePosts, ...liveCustom]),
  ];
  validatePublicationLinks(
    config,
    blogRoutes,
    extensions.template.sections,
    context.routes,
  );
  const routes = resolvePublishedRoutes({
    demoRoutesEnabled: config.features.demoRoutes,
    blogRoutes,
    definitions: context.routes,
  });
  validateContentLinks(
    livePosts.flatMap((post) => post.bodyLinks),
    routes,
  );
  const blogAssets = (items) =>
    items.flatMap((post) => [
      post.cover,
      ...(post.bodyImages ?? []).map((image) => image.url),
      ...(post.bodyLinks ?? []),
    ]);
  const publication = publishedPortfolio(config, extensions.template.sections);
  const authored = collectAssets([
    // Dormant extension settings are retained for switching, and validated only
    // when activated. Ordinary author content (including drafts) still validates.
    { ...config, template: publication.template, plugins: publication.plugins },
    blogAssets(posts),
    blogAssets(custom),
  ]);
  const published = collectAssets([
    publication,
    blogAssets(livePosts),
    blogAssets(liveCustom),
  ]);
  const media = {};
  const assets = {};
  for (const asset of [...authored].sort()) {
    const source = path.join(
      root,
      asset.startsWith("/portfolio/") ? "content/assets" : "public",
      asset.slice(1),
    );
    const bytes = await fs.readFile(source).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      throw Object.assign(
        new Error(
          `Referenced asset ${asset} does not exist at ${path.relative(root, source).replaceAll("\\", "/")}.${asset === config.site.resume.pdf || asset === config.site.resume.image ? " If the resume is generated, run npm run resume:build first." : ""}`,
          { cause: error },
        ),
        { code: "ENOENT" },
      );
    });
    const entry = {
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    if (/\.(?:avif|gif|jpe?g|png|webp|svg)$/i.test(asset)) {
      const { width, height, orientation } = await sharp(bytes).metadata();
      if (!width || !height) throw new Error(`Cannot measure image ${asset}`);
      Object.assign(
        entry,
        orientation >= 5 ? { width: height, height: width } : { width, height },
      );
      const budget = asset.startsWith("/portfolio/photography/") ? 2 : 4;
      if (bytes.length > budget * 1024 * 1024)
        throw new Error(`Image exceeds ${budget} MiB: ${asset}`);
    }
    if (published.has(asset)) {
      media[asset] = entry;
      if (asset.startsWith("/portfolio/")) assets[asset] = bytes;
    }
  }
  return {
    root,
    profileSource,
    publicationSource,
    extensions,
    contract: await prepareContract(root, config, context, extensions),
    config,
    media,
    assets,
    posts: publishedMarkdownBlogPosts(posts),
    customPosts: liveCustom,
    routes,
  };
}

export function generatedOutputs(prepared, root = projectRoot) {
  // Integrity hashes and byte budgets are build-only; clients need geometry only.
  const dimensions = Object.fromEntries(
    Object.entries(prepared.media)
      .filter(([, image]) => image.width && image.height)
      .map(([asset, image]) => [
        asset,
        { width: image.width, height: image.height },
      ]),
  );
  const metadata = `// Generated by content:build. Do not edit.\nexport const mediaManifest: Record<string, { width: number; height: number }> = ${JSON.stringify(dimensions, null, 2)};\n`;
  return [
    ...extensionOutputs(prepared.extensions),
    ...(prepared.contract ?? []).map(([target, contents]) => ({
      target: path.relative(root, target),
      contents,
    })),
    {
      target: "public/portfolio",
      files: Object.keys(prepared.media)
        .filter((asset) => asset.startsWith("/portfolio/"))
        .map((asset) => [
          asset.slice("/portfolio/".length),
          prepared.assets[asset],
        ]),
    },
    { target: "src/portfolio/media.generated.ts", contents: metadata },
    {
      target: "src/blog/posts.generated.ts",
      contents: `// Generated by content:build. Published content only.\nimport type { MarkdownBlogPost } from './types';\nexport const markdownPosts = ${JSON.stringify(prepared.posts, null, 2)} satisfies MarkdownBlogPost[];\n`,
    },
    {
      target: "src/blog/custom-posts.generated.ts",
      contents: `// Generated by content:build. Published custom content only.\nimport type { CustomBlogPost } from './types';\nexport const customBlogPosts = ${JSON.stringify(prepared.customPosts, null, 2)} satisfies CustomBlogPost[];\n`,
    },
    {
      target: ".generated/publication.json",
      contents: JSON.stringify(
        {
          revision: createHash("sha256")
            .update(
              JSON.stringify([
                prepared.contract?.map(([, contents]) => contents),
                prepared.extensions,
                prepared.posts,
                prepared.customPosts,
                prepared.routes,
                prepared.media,
              ]),
            )
            .digest("hex"),
          routes: prepared.routes,
          media: prepared.media,
        },
        null,
        2,
      ),
    },
  ];
}

export function assertProjectPublicationAllowed(
  prepared,
  root = projectRoot,
  options,
) {
  assertProfilePublicationAllowed(root, prepared.config, options);
}

export async function publishContent(prepared, root = projectRoot, options) {
  root = path.resolve(root);
  if (prepared.root !== root)
    throw new Error("Prepared content belongs to another project");
  const publish = async (lease) => {
    assertProjectLease(root, lease);
    assertProjectPublicationAllowed(prepared, root, options);
    const verify = async () => {
      const [source, publication] = await Promise.all([
        readOptional(path.join(root, "portfolio.json")),
        readOptional(path.join(root, ".generated/publication.json")),
      ]);
      if (
        source !== (options?.profileSource ?? prepared.profileSource) ||
        publication !== prepared.publicationSource
      )
        throw new Error(
          "Content changed after preparation. Retry with the current source and publication.",
        );
      if (
        source !== null &&
        JSON.stringify(JSON.parse(source)) !== JSON.stringify(prepared.config)
      )
        throw new Error(
          "Prepared configuration does not match the current profile. Use updateProfile to change author configuration.",
        );
    };
    await verify();
    await commitGeneratedOutputs(root, generatedOutputs(prepared, root), {
      beforeCommit: verify,
    });
  };
  return options?.lease
    ? publish(options.lease)
    : withProjectWriteLock(root, publish);
}

export async function checkGeneratedContent(prepared, root = projectRoot) {
  for (const output of generatedOutputs(prepared, root)) {
    if (output.files) {
      const directory = path.join(root, output.target);
      const files = await fs
        .readdir(directory, { recursive: true, withFileTypes: true })
        .catch(() => []);
      const actual = files
        .filter((entry) => entry.isFile())
        .map((entry) =>
          path
            .relative(directory, path.join(entry.parentPath, entry.name))
            .split(path.sep)
            .join("/"),
        )
        .sort();
      const expected = output.files.map(([relative]) => relative).sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error("Published asset set is stale. Run content:build.");
      for (const [relative, bytes] of output.files) {
        if (!(await fs.readFile(path.join(directory, relative))).equals(bytes))
          throw new Error(`Stale published asset: ${relative}`);
      }
    } else {
      const actual = await fs
        .readFile(path.join(root, output.target), "utf8")
        .catch(() => "");
      if (
        actual.replaceAll("\r\n", "\n") !==
        output.contents.replaceAll("\r\n", "\n")
      )
        throw new Error(
          `Stale generated file: ${output.target}. Run content:build.`,
        );
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const prepared = await prepareContent();
  if (!process.argv.includes("--check")) {
    await publishContent(prepared);
  } else await checkGeneratedContent(prepared);
  console.log(
    `Content ${process.argv.includes("--check") ? "validated" : "built"}: ${prepared.routes.length} routes, ${Object.keys(prepared.media).length} published assets.`,
  );
}
