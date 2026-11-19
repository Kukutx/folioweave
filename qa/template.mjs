import { loadQaProfile } from "./profile.mjs";
import {
  loadCatalog,
  resolveExtensions,
  templatePages,
} from "../src/core/extensions.mjs";

/**
 * The template the profile under test selects, as the suites need it: its id,
 * its gallery category (`personal` or `store`), the home sections its manifest
 * lists and the pages it adds at their resolved paths.
 *
 * Suites decide what to check from this, never from the shape of one profile:
 * a check written for Classic's sections runs only where Classic renders, and
 * a shop's checks run wherever a store template renders.
 */
export function qaTemplate(profile = loadQaProfile()) {
  const resolved = resolveExtensions(profile, loadCatalog());
  const { template } = resolved;
  const category = template.category ?? "personal";
  return {
    id: template.id,
    name: template.name,
    category,
    classic: template.id === "classic",
    store: category === "store",
    sections: template.sections ?? [],
    pages: templatePages(resolved),
    options: resolved.options,
    menuToggle: menuToggle(template.id),
  };
}

/**
 * The button that opens the small-screen menu. Classic names its own; other
 * templates are found by the disclosure contract every menu button keeps in
 * the page header (it controls the menu and says whether it is open).
 */
function menuToggle(id) {
  return id === "classic"
    ? ".mobile-menu-toggle"
    : "header button[aria-controls][aria-expanded]";
}

/**
 * Runs a suite only where the template renders what it checks, and says so
 * when it does not, so a skipped suite never reads as a passing one.
 */
export function onlyFor(template, applies, suite) {
  if (applies) return false;
  console.log(
    `SKIP ${suite}: the ${template.name} template (${template.id}, ${template.category}) does not render what this suite checks.`,
  );
  return true;
}
