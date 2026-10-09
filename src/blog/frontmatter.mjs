import { load } from "js-yaml";

/** The author format is YAML frontmatter followed by Markdown, not executable engines. */
export function parseFrontmatter(source) {
  source = source.replace(/^\uFEFF/, "");
  if (!/^---[ \t]*\r?\n/.test(source)) return { data: {}, content: source };
  const match = source.match(
    /^---[ \t]*\r?\n([\s\S]*?)^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m,
  );
  if (!match)
    throw new Error("YAML frontmatter needs a closing --- delimiter.");
  const data = load(match[1]) ?? {};
  if (typeof data !== "object" || Array.isArray(data))
    throw new Error(
      "YAML frontmatter must be a mapping of field names to values.",
    );
  return { data, content: source.slice(match[0].length) };
}
