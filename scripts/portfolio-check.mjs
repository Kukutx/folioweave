import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const configPath = path.join(root, "portfolio.json");
const errors = [];
const warnings = [];
const assets = new Map();

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
    return {};
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string.`);
}

function addAsset(value, label) {
  if (!value) return;
  if (typeof value !== "string" || !value.startsWith("/")) {
    fail(`${label} must use a local public path beginning with "/".`);
    return;
  }
  const clean = value.split(/[?#]/, 1)[0];
  if (!assets.has(clean)) assets.set(clean, []);
  assets.get(clean).push(label);
}

let portfolio;
try {
  portfolio = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (error) {
  fail(`portfolio.json could not be parsed: ${error.message}`);
  portfolio = {};
}

const site = requireObject(portfolio.site, "site");
const identity = requireObject(site.identity, "site.identity");
const contact = requireObject(site.contact, "site.contact");
const location = requireObject(site.location, "site.location");
const resume = requireObject(site.resume, "site.resume");
const siteAssets = requireObject(site.assets, "site.assets");
const features = requireObject(portfolio.features, "features");
const hero = requireObject(portfolio.hero, "hero");
const about = requireObject(portfolio.about, "about");
const photography = requireObject(portfolio.photography, "photography");
const seo = requireObject(portfolio.seo, "seo");

requireText(identity.name, "site.identity.name");
requireText(identity.firstName, "site.identity.firstName");
requireText(identity.initials, "site.identity.initials");
requireText(identity.role, "site.identity.role");
requireText(identity.country, "site.identity.country");
requireText(contact.email, "site.contact.email");
if (typeof contact.email === "string" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) {
  fail("site.contact.email is not a valid email address.");
}
try {
  const origin = new URL(site.origin);
  if (!/^https?:$/.test(origin.protocol)) throw new Error("unsupported protocol");
} catch {
  fail("site.origin must be a valid http(s) URL.");
}
try {
  new Intl.DateTimeFormat("en", { timeZone: location.timeZone }).format(new Date());
} catch {
  fail(`site.location.timeZone is invalid: ${location.timeZone ?? "(missing)"}`);
}

if (!Array.isArray(hero.greetings) || hero.greetings.length === 0) fail("hero.greetings must contain at least one greeting.");
if (!Array.isArray(hero.portraits) || hero.portraits.length === 0) fail("hero.portraits must contain at least one portrait.");
if (!Array.isArray(portfolio.projects)) fail("projects must be an array.");
if (!Array.isArray(photography.images)) fail("photography.images must be an array.");
if (!Array.isArray(about.timeline)) fail("about.timeline must be an array.");
if (!Array.isArray(about.story)) fail("about.story must be an array.");
requireText(seo.description, "seo.description");

addAsset(siteAssets.socialPreview, "site.assets.socialPreview");
addAsset(siteAssets.appStoreBadge, "site.assets.appStoreBadge");
if (features.resume && resume.enabled) {
  addAsset(resume.image, "site.resume.image");
  addAsset(resume.pdf, "site.resume.pdf");
}
for (const [index, src] of (hero.portraits ?? []).entries()) addAsset(src, `hero.portraits[${index}]`);
for (const [groupName, segments] of [["roleLine", hero.roleLine], ["summary", hero.summary]]) {
  for (const [index, segment] of (segments ?? []).entries()) {
    if (segment?.brand?.icon) addAsset(segment.brand.icon, `hero.${groupName}[${index}].brand.icon`);
  }
}
for (const [index, src] of (about.galleryImages ?? []).entries()) addAsset(src, `about.galleryImages[${index}]`);
if (features.photography) {
  if ((photography.images ?? []).length === 0) warn("Photography is enabled but photography.images is empty.");
  for (const [index, src] of (photography.images ?? []).entries()) addAsset(src, `photography.images[${index}]`);
}

const ids = new Set();
const enabledProjects = (portfolio.projects ?? []).filter((project) => project?.enabled);
if (features.work && enabledProjects.length === 0) warn("Work is enabled but no projects are enabled.");
for (const [index, project] of (portfolio.projects ?? []).entries()) {
  const label = `projects[${index}]`;
  requireText(project?.id, `${label}.id`);
  requireText(project?.name, `${label}.name`);
  if (ids.has(project?.id)) fail(`Duplicate project id: ${project.id}`);
  if (project?.id) ids.add(project.id);
  if (!project?.enabled) continue;
  const hasImage = Boolean(project.image?.desktop && project.image?.mobile);
  const hasCarousel = Array.isArray(project.carouselImages) && project.carouselImages.length > 0;
  if (!hasImage && !hasCarousel) fail(`${label} (${project.name}) needs image or carouselImages.`);
  if (project.layout === "carousel" && !hasCarousel) fail(`${label} uses carousel layout but carouselImages is empty.`);
  if (project.layout === "story" && !project.story) warn(`${label} uses story layout without a story block.`);
  addAsset(project.icon, `${label}.icon`);
  addAsset(project.image?.desktop, `${label}.image.desktop`);
  addAsset(project.image?.mobile, `${label}.image.mobile`);
  for (const [slideIndex, src] of (project.carouselImages ?? []).entries()) addAsset(src, `${label}.carouselImages[${slideIndex}]`);
  addAsset(project.badge?.previewImage, `${label}.badge.previewImage`);
  addAsset(project.story?.image, `${label}.story.image`);
}


let foundAssets = 0;
for (const [publicPath, labels] of assets) {
  const relative = publicPath.slice(1).replaceAll("/", path.sep);
  const absolute = path.resolve(publicDir, relative);
  const insidePublic = absolute === publicDir || absolute.startsWith(`${publicDir}${path.sep}`);
  if (!insidePublic) {
    fail(`${publicPath} resolves outside public/.`);
    continue;
  }
  if (!fs.existsSync(absolute)) {
    fail(`Missing asset ${publicPath} (${labels.join(", ")}).`);
  } else {
    foundAssets += 1;
  }
}

if (warnings.length) {
  console.log("\nPortfolio warnings:");
  for (const message of warnings) console.log(`  - ${message}`);
}
if (errors.length) {
  console.error("\nPortfolio content check failed:");
  for (const message of errors) console.error(`  - ${message}`);
  process.exitCode = 1;
} else {
  console.log(`Portfolio content OK — ${enabledProjects.length} enabled projects, ${(photography.images ?? []).length} photos, ${foundAssets} local assets verified.`);
}
