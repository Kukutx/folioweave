import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

// These routes own their publication rules (home, blog index, generated posts).
const contentRoutes = new Set(["/", "/blogs", "/blogs/[slug]"]);

export function pageRoute(filename) {
  const segments = filename.replaceAll("\\", "/").split("/").slice(0, -1);
  if (segments.some((part) => part.startsWith("_"))) return null;
  if (
    segments.some(
      (part) =>
        part.startsWith("@") ||
        part.startsWith("(.)") ||
        part.startsWith("(..") ||
        part.includes("%"),
    )
  )
    throw new Error(
      `Route convention needs an explicit publication policy: ${filename}`,
    );
  return "/" + segments.filter((part) => !/^\([^()]+\)$/.test(part)).join("/");
}

export function hasPublicationGuard(source, route) {
  const file = ts.createSourceFile(
    "page.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const imports = file.statements.filter(ts.isImportDeclaration);
  const guardImport = imports.find(
    (item) => item.moduleSpecifier.text === "@/portfolio/route-guard",
  );
  const bindings = guardImport?.importClause?.namedBindings;
  const binding =
    bindings && ts.isNamedImports(bindings)
      ? bindings.elements.find(
          (item) =>
            (item.propertyName ?? item.name).text === "requirePublishedRoute" &&
            !item.isTypeOnly,
        )
      : undefined;
  if (!binding || guardImport.importClause.isTypeOnly) return false;
  const page = file.statements.find(
    (item) =>
      ts.isFunctionDeclaration(item) &&
      item.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
      ),
  );
  const first = page?.body?.statements[0];
  if (
    !first ||
    !ts.isExpressionStatement(first) ||
    !ts.isCallExpression(first.expression)
  )
    return false;
  const call = first.expression;
  // A top-level, unconditional first statement: comments/dead code do not count.
  return (
    ts.isIdentifier(call.expression) &&
    call.expression.text === binding.name.text &&
    !page.parameters.some(
      (parameter) => parameter.name.getText(file) === binding.name.text,
    ) &&
    call.arguments.length === 1 &&
    ts.isStringLiteral(call.arguments[0]) &&
    call.arguments[0].text === route
  );
}

export async function validateRouteContract(root, routes, customPosts) {
  const app = path.join(root, "src/app");
  const files = await fs.readdir(app, { recursive: true, withFileTypes: true });
  const pages = new Map();
  for (const entry of files.filter(
    (item) => item.isFile() && /^page\.(tsx?|jsx?)$/.test(item.name),
  )) {
    const absolute = path.join(entry.parentPath, entry.name);
    const route = pageRoute(path.relative(app, absolute));
    if (route === null) continue;
    if (pages.has(route)) throw new Error(`Duplicate page route: ${route}`);
    pages.set(route, absolute);
  }
  const registered = new Map();
  for (const item of routes) {
    if (
      !/^\/[a-z0-9]+(?:[/-][a-z0-9]+)*$/.test(item.path) ||
      typeof item.demoOnly !== "boolean"
    )
      throw new Error(`Invalid route registration: ${item.path}`);
    if (registered.has(item.path) || contentRoutes.has(item.path))
      throw new Error(`Duplicate/reserved route registration: ${item.path}`);
    registered.set(item.path, item);
    if (!pages.has(item.path))
      throw new Error(`Registered page missing: ${item.path}`);
  }
  for (const [route, filename] of pages) {
    if (contentRoutes.has(route)) continue;
    if (!registered.has(route)) throw new Error(`Unclassified page: ${route}`);
    if (!hasPublicationGuard(await fs.readFile(filename, "utf8"), route))
      throw new Error(
        `Page must begin with requirePublishedRoute(${JSON.stringify(route)}): ${filename}`,
      );
  }
  for (const route of contentRoutes)
    if (!pages.has(route)) throw new Error(`Content route missing: ${route}`);
  for (const post of customPosts) {
    const route = `/blogs/${post.slug}`;
    if (!registered.has(route) || !pages.has(route))
      throw new Error(
        `Custom blog must have a registered, guarded page: ${route}`,
      );
  }
}
