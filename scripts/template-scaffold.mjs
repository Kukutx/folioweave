import fs from "node:fs/promises";
import path from "node:path";
import points from "../src/core/extension-points.json" with { type: "json" };

/** Independent route entries are part of the contract, including in examples. */
export async function scaffoldTemplate(root, id) {
  if (!/^[a-z][a-z0-9-]*$/.test(id))
    throw new Error(
      "Template id must use lowercase letters, digits and hyphens.",
    );
  const directory = path.join(root, "src/templates", id);
  await fs.mkdir(directory);
  const views = {
    Layout: `({ children, context, slots }) => <div className={styles.site}>
  <header><Link href="/">{context.site.identity.name}</Link>{context.capabilities.writing && <> · <Link href="/blogs">Writing</Link></>}</header>
  {children}<footer>{slots.footer}</footer>{slots.floating}
</div>`,
    Home: `({ context }) => <main id="home">
  <h1>{String(context.options.heading ?? context.site.identity.name)}</h1>
  <p>{context.site.identity.role}</p>
  {context.features.work && <section id="work"><h2>Selected work</h2>{context.projects.map((project) => <h3 key={project.id}>{project.name}</h3>)}</section>}
  <section id="contact"><h2>Contact</h2><a href={"mailto:" + context.site.contact.email}>{context.site.contact.email}</a></section>
</main>`,
    BlogIndex: `({ posts, context }) => <main><h1>{context.writing.title}</h1>
  <ul>{posts.map((post) => <li key={post.slug}><Link href={post.href}>{post.title}</Link></li>)}</ul>
</main>`,
    BlogPost: `({ post, afterArticle }) => <main>
  <article><h1>{post.title}</h1><ArticleBody post={post} /></article>{afterArticle}
</main>`,
    BlogTag: `({ tag }) => <main><h1>{tag.label}</h1>
  <ul>{tag.posts.map((post) => <li key={post.slug}><Link href={post.href}>{post.title}</Link></li>)}</ul>
</main>`,
  };
  for (const [view, filename] of Object.entries(points.views)) {
    const imports = [
      'import type { TemplateModule } from "@/core/contracts";',
      ...(["Layout", "BlogIndex", "BlogTag"].includes(view)
        ? ['import Link from "next/link";']
        : []),
      ...(view === "Layout"
        ? ['import styles from "./template.module.css";']
        : []),
      ...(view === "BlogPost"
        ? ['import { ArticleBody } from "@/components/blog/article-body";']
        : []),
    ];
    await fs.writeFile(
      path.join(directory, `${filename}.tsx`),
      `${imports.join("\n")}\n\nconst ${view}: TemplateModule["${view}"] = ${views[view]};\nexport default ${view};\n`,
    );
  }
  await fs.writeFile(
    path.join(directory, "template.module.css"),
    `.site {
  --fw-font: system-ui, sans-serif;
  --fw-surface: #ffffff;
  --fw-text: #18212b;
  --fw-border: #ccd6dd;
  --fw-accent: #145a73;
  --fw-on-accent: #ffffff;
  min-height: 100vh;
  padding: 2rem;
  background: var(--fw-surface);
  color: var(--fw-text);
  font: 18px/1.6 var(--fw-font);
}
.site main { max-width: 800px; margin: 3rem auto; }
.site a { color: var(--fw-accent); }
`,
  );
  // Register only after every referenced source file exists.
  await fs.writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(
      {
        id,
        name: id,
        description: "A new FolioWeave template.",
        version: "1.0.0",
        apiVersion: 1,
        entries: Object.fromEntries(
          Object.entries(points.views).map(([view, filename]) => [
            view,
            `${filename}.tsx`,
          ]),
        ),
        slots: Object.keys(points.slots),
        sections: ["home", "work", "contact"],
        optionsSchema: {
          type: "object",
          additionalProperties: false,
          properties: { heading: { type: "string", minLength: 1 } },
        },
      },
      null,
      2,
    ) + "\n",
  );
}
