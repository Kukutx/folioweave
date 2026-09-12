import { resolvePublishedRoutes } from "../portfolio/publication-policy.mjs";
import { requireImagePath } from "../portfolio/content-policy.mjs";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

export const BLOG_FILENAME = /^[a-z0-9][a-z0-9-]*\.md$/;
export const BLOG_SLUG = /^[a-z0-9][a-z0-9-]*$/;
export const BLOG_FRONTMATTER_FIELDS = new Set([
  "title",
  "subtitle",
  "date",
  "description",
  "cover",
  "tags",
  "draft",
]);
export const CUSTOM_BLOG_FIELDS = new Set([
  "slug",
  "title",
  "subtitle",
  "date",
  "displayDate",
  "description",
  "excerpt",
  "intro",
  "cover",
  "tags",
  "readingMinutes",
]);

export class BlogContentError extends Error {
  constructor(issues) {
    super(
      `Blog content validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
    );
    this.name = "BlogContentError";
    this.issues = issues;
  }
}

function requireText(value, field, label, issues) {
  if (typeof value !== "string" || !value.trim()) {
    issues.push(`${label}.${field} must be a non-empty string.`);
    return "";
  }
  return value.trim();
}

function optionalText(value, field, label, issues) {
  if (value == null || value === "") return undefined;
  return requireText(value, field, label, issues) || undefined;
}

function normalizeDate(value, label, issues) {
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    issues.push(`${label}.date must use YYYY-MM-DD.`);
    return "";
  }
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    issues.push(`${label}.date is not a valid calendar date.`);
    return "";
  }
  return raw;
}

function rawFrontmatterScalar(source, field) {
  const block = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!block) return undefined;
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const raw = block.match(new RegExp(`^${escaped}:\\s*(.*?)\\s*$`, "m"))?.[1];
  if (!raw) return undefined;
  const quote = raw[0];
  return (quote === '"' || quote === "'") && raw.at(-1) === quote
    ? raw.slice(1, -1)
    : raw;
}

function normalizeTags(value, label, issues) {
  if (value == null) return [];
  if (
    !Array.isArray(value) ||
    value.some((tag) => typeof tag !== "string" || !tag.trim())
  ) {
    issues.push(`${label}.tags must be an array of non-empty strings.`);
    return [];
  }
  return [...new Set(value.map((tag) => tag.trim()))];
}

function parseMarkdown(content) {
  return unified().use(remarkParse).use(remarkGfm).parse(content);
}

function walk(node, visitor) {
  visitor(node);
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) walk(child, visitor);
}

function nodeText(node) {
  let text = "";
  walk(node, (current) => {
    if (
      current !== node &&
      typeof current.value === "string" &&
      current.type === "text"
    ) {
      text += `${current.value} `;
    }
  });
  return text.trim();
}

function analyzeMarkdown(content, label, issues, warnings) {
  const tree = parseMarkdown(content);
  const definitions = new Map();
  const imageNodes = [];
  const linkNodes = [];
  const readingText = [];

  walk(tree, (node) => {
    if (node.type === "definition") definitions.set(node.identifier, node.url);
    if (node.type === "heading" && node.depth === 1) {
      issues.push(
        `${label} contains a level-one Markdown heading${nodeText(node) ? ` ("${nodeText(node)}")` : ""}; frontmatter.title is the only H1, so article body headings must start at ##.`,
      );
    }
    if (node.type === "image" || node.type === "imageReference")
      imageNodes.push(node);
    if (node.type === "link" || node.type === "linkReference")
      linkNodes.push(node);
    if (node.type === "text" && typeof node.value === "string")
      readingText.push(node.value);
  });

  const images = [];
  for (const node of imageNodes) {
    const url =
      node.type === "image" ? node.url : definitions.get(node.identifier);
    if (!url) {
      issues.push(`${label} contains an unresolved Markdown image reference.`);
      continue;
    }
    try {
      requireImagePath(url);
    } catch (error) {
      issues.push(`${label}: ${error.message}`);
      continue;
    }
    const alt = typeof node.alt === "string" ? node.alt.trim() : "";
    if (!alt) warnings.push(`${label} image ${url} has empty alt text.`);
    images.push({ url, alt });
  }

  const plainText = readingText.join(" ");
  const cjkChars = (plainText.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? [])
    .length;
  const latinWords = (
    plainText
      .replace(/[\u3400-\u9fff\uf900-\ufaff]/g, " ")
      .match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu) ?? []
  ).length;
  const readingMinutes = Math.max(
    1,
    Math.ceil(latinWords / 220 + cjkChars / 500),
  );
  const links = linkNodes
    .map((node) =>
      node.type === "link" ? node.url : definitions.get(node.identifier),
    )
    .filter(Boolean);
  return { images, links, readingMinutes };
}

/**
 * @param {{ blogsDir: string, reservedSlugs?: string[] }} options
 */
export function loadMarkdownBlogPosts({ blogsDir, reservedSlugs = [] }) {
  if (!fs.existsSync(blogsDir)) return { posts: [], warnings: [] };
  const issues = [];
  const warnings = [];
  const reserved = new Set(reservedSlugs);
  const posts = [];
  const entries = fs
    .readdirSync(blogsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        !entry.name.startsWith("_") &&
        !entry.name.startsWith("."),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fileName = entry.name;
    if (!BLOG_FILENAME.test(fileName)) {
      issues.push(
        `${fileName}: blog filenames must use lowercase letters, numbers, and hyphens only.`,
      );
      continue;
    }
    const slug = fileName.slice(0, -3);
    const label = `blog ${slug}`;
    if (reserved.has(slug)) {
      issues.push(
        `${fileName}: slug "${slug}" conflicts with a registered custom blog.`,
      );
    }

    let parsed;
    let source;
    try {
      source = fs.readFileSync(path.join(blogsDir, fileName), "utf8");
      parsed = matter(source);
    } catch (error) {
      issues.push(
        `${fileName}: Markdown/frontmatter could not be parsed: ${error.message}`,
      );
      continue;
    }

    const unknownFields = Object.keys(parsed.data).filter(
      (field) => !BLOG_FRONTMATTER_FIELDS.has(field),
    );
    if (unknownFields.length) {
      issues.push(
        `${fileName}: unknown frontmatter field(s): ${unknownFields.join(", ")}.`,
      );
    }

    const title = requireText(parsed.data.title, "title", label, issues);
    const subtitle = optionalText(
      parsed.data.subtitle,
      "subtitle",
      label,
      issues,
    );
    const date = normalizeDate(
      rawFrontmatterScalar(source, "date") ?? parsed.data.date,
      label,
      issues,
    );
    const description = requireText(
      parsed.data.description,
      "description",
      label,
      issues,
    );
    const cover = optionalText(parsed.data.cover, "cover", label, issues);
    if (cover)
      try {
        requireImagePath(cover);
      } catch (error) {
        issues.push(`${label}.cover: ${error.message}`);
      }
    const tags = normalizeTags(parsed.data.tags, label, issues);
    const draft = parsed.data.draft ?? false;
    if (typeof draft !== "boolean") {
      issues.push(`${label}.draft must be boolean when provided.`);
    }
    if (!parsed.content.trim())
      issues.push(`${fileName}: blog body must not be empty.`);

    let analysis = { images: [], links: [], readingMinutes: 1 };
    try {
      analysis = analyzeMarkdown(parsed.content, label, issues, warnings);
    } catch (error) {
      issues.push(
        `${fileName}: Markdown body could not be parsed: ${error.message}`,
      );
    }

    posts.push({
      slug,
      href: `/blogs/${slug}`,
      title,
      ...(subtitle ? { subtitle } : {}),
      date,
      description,
      ...(cover ? { cover } : {}),
      tags,
      readingMinutes: analysis.readingMinutes,
      kind: "markdown",
      content: parsed.content.trim(),
      draft: draft === true,
      bodyImages: analysis.images,
      bodyLinks: analysis.links,
      sourceFile: fileName,
    });
  }

  if (issues.length) throw new BlogContentError(issues);
  return { posts, warnings };
}

export function publishedMarkdownBlogPosts(posts) {
  return posts
    .filter((post) => !post.draft)
    .map((post) => {
      const published = { ...post };
      delete published.draft;
      delete published.bodyImages;
      delete published.bodyLinks;
      delete published.sourceFile;
      return published;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function normalizeCustomBlogPosts(value) {
  const issues = [];
  if (!Array.isArray(value))
    throw new BlogContentError(["Custom blog registry must be an array."]);
  const seen = new Set();
  const posts = value
    .map((raw, index) => {
      const label = `custom blog[${index}]`;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        issues.push(`${label} must be an object.`);
        return null;
      }
      const unknownFields = Object.keys(raw).filter(
        (field) => !CUSTOM_BLOG_FIELDS.has(field),
      );
      if (unknownFields.length) {
        issues.push(`${label}: unknown field(s): ${unknownFields.join(", ")}.`);
      }
      const slug = requireText(raw.slug, "slug", label, issues);
      if (slug && !BLOG_SLUG.test(slug))
        issues.push(
          `${label}.slug must use lowercase letters, numbers, and hyphens.`,
        );
      if (slug && seen.has(slug))
        issues.push(`Duplicate custom blog slug: ${slug}.`);
      if (slug) seen.add(slug);
      const href = slug ? `/blogs/${slug}` : "";
      const title = requireText(raw.title, "title", label, issues);
      const subtitle = optionalText(raw.subtitle, "subtitle", label, issues);
      const date = normalizeDate(raw.date, label, issues);
      const displayDate = optionalText(
        raw.displayDate,
        "displayDate",
        label,
        issues,
      );
      const description = requireText(
        raw.description,
        "description",
        label,
        issues,
      );
      const excerpt = optionalText(raw.excerpt, "excerpt", label, issues);
      const intro = optionalText(raw.intro, "intro", label, issues);
      const cover = optionalText(raw.cover, "cover", label, issues);
      if (cover)
        try {
          requireImagePath(cover);
        } catch (error) {
          issues.push(`${label}.cover: ${error.message}`);
        }
      const tags = normalizeTags(raw.tags, label, issues);
      const readingMinutes = raw.readingMinutes;
      if (!Number.isInteger(readingMinutes) || readingMinutes < 1) {
        issues.push(`${label}.readingMinutes must be a positive integer.`);
      }
      return {
        slug,
        href,
        title,
        ...(subtitle ? { subtitle } : {}),
        date,
        ...(displayDate ? { displayDate } : {}),
        description,
        ...(excerpt ? { excerpt } : {}),
        ...(intro ? { intro } : {}),
        ...(cover ? { cover } : {}),
        tags,
        readingMinutes: Number.isInteger(readingMinutes) ? readingMinutes : 1,
        kind: "custom",
      };
    })
    .filter(Boolean);
  if (issues.length) throw new BlogContentError(issues);
  return posts;
}

export function publishedCustomBlogPosts(posts, demoRoutesEnabled) {
  const routes = new Set(resolvePublishedRoutes({ demoRoutesEnabled }));
  return posts.filter((post) => routes.has(post.href));
}
