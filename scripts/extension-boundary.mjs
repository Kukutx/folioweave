import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

/** Resolve aliases and relative imports alike; comments cannot satisfy the check. */
export function extensionImportViolations(filename, source) {
  filename = filename.replaceAll("\\", "/");
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const errors = [];
  const own = filename.match(/^src\/(templates|plugins)\/([^/]+)\//);
  const shared =
    /^src\/(?:components|hooks|lib|config|blog|content|core)\//.test(filename);
  function check(specifier) {
    const target = specifier.startsWith("@/")
      ? `src/${specifier.slice(2)}`
      : specifier.startsWith(".")
        ? path.posix.normalize(
            path.posix.join(path.posix.dirname(filename), specifier),
          )
        : null;
    if (!target) return;
    const other = target.match(/^src\/(templates|plugins)\/([^/]+)(?:\/|$)/);
    if (
      (own && other && (own[1] !== other[1] || own[2] !== other[2])) ||
      (shared && other) ||
      (own?.[1] === "plugins" &&
        /^src\/(?:portfolio|config|content|blog)(?:\/|$)/.test(target)) ||
      ((own || shared) && /^src\/demo(?:\/|$)/.test(target))
    ) {
      errors.push(`${filename}: forbidden dependency ${specifier} (${target})`);
    }
  }
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      check(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require")) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      check(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return errors;
}

export async function checkExtensionBoundaries(root) {
  const entries = await fs.readdir(path.join(root, "src"), {
    withFileTypes: true,
    recursive: true,
  });
  const errors = [];
  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !/\.(?:tsx?|mjs|cjs)$/.test(entry.name) ||
      entry.name.includes(".generated.")
    )
      continue;
    const filename = path.join(entry.parentPath, entry.name);
    errors.push(
      ...extensionImportViolations(
        path.relative(root, filename),
        await fs.readFile(filename, "utf8"),
      ),
    );
  }
  if (errors.length) throw new Error(errors.join("\n"));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await checkExtensionBoundaries(path.resolve(import.meta.dirname, ".."));
  console.log("Template/plugin dependency boundaries passed.");
}
