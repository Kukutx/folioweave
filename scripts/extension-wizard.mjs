import fs from "node:fs/promises";
import path from "node:path";
import { loadCatalog, resolveExtensions } from "../src/core/extensions.mjs";

/** Shared by the existing personalization flow; plugin options are public JSON. */
export async function configureExtensions(rl, profile, root) {
  const catalog = loadCatalog(root);
  console.log("\nAvailable templates:");
  catalog.templates.forEach((item) =>
    console.log(`  ${item.id} — ${item.description}`),
  );
  for (;;) {
    const current = profile.template?.id ?? "classic";
    const id = (await rl.question(`Template [${current}]: `)).trim() || current;
    if (!catalog.templates.some((item) => item.id === id)) {
      console.log("Choose a listed template id.");
      continue;
    }
    profile.template = { id, settings: profile.template?.settings ?? {} };
    const optionsPath = (
      await rl.question("Template options JSON file (Enter to keep defaults): ")
    ).trim();
    try {
      if (optionsPath)
        profile.template.settings[id] = JSON.parse(
          await fs.readFile(path.resolve(root, optionsPath), "utf8"),
        );
      resolveExtensions({ ...profile, plugins: {} }, catalog);
      break;
    } catch (error) {
      console.log(error.message);
    }
  }
  for (const plugin of catalog.plugins) {
    const current = profile.plugins?.[plugin.id];
    const answer = (
      await rl.question(
        `Enable ${plugin.name}? [${current?.enabled ? "Y/n" : "y/N"}]: `,
      )
    )
      .trim()
      .toLowerCase();
    const enabled = answer
      ? ["y", "yes"].includes(answer)
      : Boolean(current?.enabled);
    if (!enabled) {
      if (current) profile.plugins[plugin.id] = { ...current, enabled: false };
      continue;
    }
    for (;;) {
      console.log(plugin.setupHelp ?? plugin.description);
      const filename = (
        await rl.question(
          "Plugin options JSON file (Enter to keep current options, - to skip): ",
        )
      ).trim();
      if (filename === "-") {
        if (current)
          profile.plugins[plugin.id] = { ...current, enabled: false };
        break;
      }
      try {
        const options = filename
          ? JSON.parse(await fs.readFile(path.resolve(root, filename), "utf8"))
          : (current?.options ?? {});
        const selection = { enabled: true, options };
        resolveExtensions(
          { ...profile, plugins: { [plugin.id]: selection } },
          catalog,
        );
        profile.plugins = { ...profile.plugins, [plugin.id]: selection };
        break;
      } catch (error) {
        console.log(error.message);
      }
    }
  }
}
