import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prepareContent, publishContent } from "../scripts/content-build.mjs";
import { collectAssets } from "../src/portfolio/content-policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const temporaryRoot = path.join(root, ".generated");

/** A public demo snapshot owns its profile and assets; it never copies author inputs. */
export async function prepareRefractFixture({
  style,
  origin,
  prefix = "refract-preview-",
  linkDependencies = true,
} = {}) {
  if (!["light", "dark"].includes(style))
    throw new Error("Choose light or dark.");
  if (!/^refract-[a-z-]+-$/.test(prefix))
    throw new Error("Invalid fixture prefix.");
  await fs.mkdir(temporaryRoot, { recursive: true });
  const directory = await fs.mkdtemp(path.join(temporaryRoot, prefix));
  const cleanup = async () => {
    const resolved = path.resolve(directory);
    if (
      path.dirname(resolved) !== temporaryRoot ||
      !path.basename(resolved).startsWith(prefix)
    )
      throw new Error("Refusing cleanup outside the owned Refract fixture.");
    await fs.rm(resolved, { recursive: true, force: true });
  };
  try {
    for (const entry of [
      "src",
      "scripts",
      "governance",
      ".github",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "next.config.ts",
      "portfolio.schema.json",
      "resume.schema.json",
      "eslint.config.mjs",
      ".gitignore",
      "vercel.json",
    ])
      await fs.cp(path.join(root, entry), path.join(directory, entry), {
        recursive: true,
      });
    // Build hooks execute the repository's real tests, with no reports or screenshots.
    await fs.cp(path.join(root, "qa"), path.join(directory, "qa"), {
      recursive: true,
      filter: (source) =>
        !/(?:[\\/]screens(?:[\\/]|$)|[\\/]baselines(?:[\\/]|$)|-report\.json$)/.test(
          source,
        ),
    });
    await fs.mkdir(path.join(directory, "content/blogs"), { recursive: true });
    await fs.mkdir(path.join(directory, "content/assets/portfolio/demo"), {
      recursive: true,
    });
    await fs.mkdir(path.join(directory, "public"), { recursive: true });
    for (const relative of [
      "content/blogs/_README.md",
      "content/assets/portfolio/README.md",
      "content/resume/README.md",
      "content/resume/resume.example.json",
    ]) {
      await fs.mkdir(path.dirname(path.join(directory, relative)), {
        recursive: true,
      });
      await fs.copyFile(
        path.join(root, relative),
        path.join(directory, relative),
      );
    }
    // Existing build validation also checks the canonical shared demo. Copy only
    // its referenced, public assets, never public/portfolio or author media.
    const canonical = JSON.parse(
      await fs.readFile(
        path.join(root, "governance/demo-portfolio.json"),
        "utf8",
      ),
    );
    const custom = JSON.parse(
      await fs.readFile(path.join(root, "src/demo/custom-posts.json"), "utf8"),
    );
    for (const asset of collectAssets([canonical, custom])) {
      if (asset.startsWith("/portfolio/"))
        throw new Error(
          `Canonical demo references author-owned media: ${asset}`,
        );
      const destination = path.join(directory, "public", asset.slice(1));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(root, "public", asset.slice(1)), destination);
    }
    await fs.cp(
      path.join(root, "public/templates/refract"),
      path.join(directory, "public/templates/refract"),
      { recursive: true },
    );
    const demoAssets = path.join(directory, "content/assets/portfolio/demo");
    await fs.cp(path.join(root, "governance/templates/assets"), demoAssets, {
      recursive: true,
    });
    await sharp(path.join(demoAssets, "social.svg"))
      .png()
      .toFile(path.join(demoAssets, "social.png"));
    await sharp(path.join(demoAssets, "icon.svg"))
      .resize(180, 180)
      .png()
      .toFile(path.join(demoAssets, "icon.png"));
    // Keep only source inputs known to belong to this public demonstration.
    await fs.writeFile(
      path.join(directory, "src/blog/custom-posts.json"),
      "[]\n",
    );
    const profile = JSON.parse(
      await fs.readFile(
        path.join(root, `governance/templates/refract-${style}.json`),
        "utf8",
      ),
    );
    if (origin) profile.site.origin = origin;
    profile.$schema = "./portfolio.schema.json";
    await fs.writeFile(
      path.join(directory, "portfolio.json"),
      JSON.stringify(profile, null, 2) + "\n",
    );
    await fs.writeFile(
      path.join(directory, "content/blogs/designing-with-constraints.md"),
      `---\nid: refract-designing-with-constraints\ntitle: Designing with constraints\ndate: 2026-10-01\ndescription: A short example about making space for the ideas that matter.\ntags:\n  - Design\n  - Process\n---\n\n## Start with the question\n\nA useful constraint brings a project into focus. Before adding a feature, ask what it helps someone understand or accomplish.\n\nThis is sample writing for the Refract portfolio template. Replace it with your own notes.\n\n## Leave room to explore\n\nKeep the core readable, then use motion to give it context. A still page should tell the same story.\n\n| Principle | Practice |\n| --- | --- |\n| Clarity | Make the next step visible |\n| Care | Respect reduced motion |\n\n## Build in the open\n\nThe template shares its content and plugins with [FolioWeave](https://github.com/Kukutx/folioweave).\n\n\`\`\`css\n.example { color: inherit; }\n\`\`\`\n`,
    );
    await fs.writeFile(
      path.join(directory, "content/blogs/observing-patterns.md"),
      `---\nid: refract-observing-patterns\ntitle: Observing patterns\ndate: 2026-09-15\ndescription: Finding a visual rhythm in the ordinary.\ntags:\n  - Design\n---\n\n## Pay attention\n\nA notebook, a walk and a little time can be enough to find a new direction.\n\n## Make a study\n\nTurn an observation into a small experiment. The four projects in this demo are illustrative studies, not commissioned work.\n`,
    );
    if (linkDependencies)
      await fs.symlink(
        path.join(root, "node_modules"),
        path.join(directory, "node_modules"),
        process.platform === "win32" ? "junction" : "dir",
      );
    // Publish through the real guard. A Git-free snapshot has its own identity;
    // parent deployment/CI environment variables never stand in for that identity.
    const prepared = await prepareContent(directory);
    await publishContent(prepared, directory, { targetBranch: "snapshot" });
    return { directory, profile, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
