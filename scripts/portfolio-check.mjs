import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const configPath = path.join(root, "portfolio.json");
const errors = [];
const warnings = [];
const assets = new Map();
const socialIcons = new Set(["twitter", "linkedin", "instagram", "github", "email", "website"]);
const projectLayouts = new Set(["standard", "featured", "story", "carousel"]);
const featureNames = ["weather", "about", "work", "photography", "resume", "demoRoutes"];

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

function validateHttpUrl(value, label) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) throw new Error("unsupported protocol");
  } catch {
    fail(`${label} must be a valid http(s) URL.`);
  }
}

function validateHref(value, label, { mailto = false, hash = false } = {}) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${label} must be a non-empty URL/path.`);
    return;
  }
  if (value.startsWith("/")) return;
  if (hash && value.startsWith("#") && value.length > 1) return;
  if (mailto && /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(value)) return;
  try {
    const url = new URL(value);
    if (/^https?:$/.test(url.protocol)) return;
  } catch {}
  fail(`${label} must use an internal path${hash ? ", hash" : ""}, http(s) URL${mailto ? ", or mailto URL" : ""}.`);
}

function validateSize(value, label) {
  if (value == null) return;
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value.some((part) => !Number.isInteger(part) || part <= 0)
  ) {
    fail(`${label} must be [width, height] with positive integers.`);
  }
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
if (typeof identity.company !== "string") fail("site.identity.company must be a string (empty is allowed).");
try {
  new Intl.Locale(identity.locale);
} catch {
  fail(`site.identity.locale is invalid: ${identity.locale ?? "(missing)"}`);
}

requireText(contact.email, "site.contact.email");
if (typeof contact.email === "string" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) {
  fail("site.contact.email is not a valid email address.");
}
validateHttpUrl(site.origin, "site.origin");

requireText(location.city, "site.location.city");
requireText(location.country, "site.location.country");
try {
  new Intl.DateTimeFormat("en", { timeZone: location.timeZone }).format(new Date());
} catch {
  fail(`site.location.timeZone is invalid: ${location.timeZone ?? "(missing)"}`);
}
if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) {
  fail("site.location.latitude must be between -90 and 90.");
}
if (!Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) {
  fail("site.location.longitude must be between -180 and 180.");
}

for (const name of featureNames) {
  if (typeof features[name] !== "boolean") fail(`features.${name} must be boolean.`);
}
if (!Array.isArray(site.socialLinks)) {
  fail("site.socialLinks must be an array.");
} else {
  for (const [index, link] of site.socialLinks.entries()) {
    const label = `site.socialLinks[${index}]`;
    requireText(link?.label, `${label}.label`);
    if (!socialIcons.has(link?.icon)) fail(`${label}.icon is not supported.`);
    validateHref(link?.href, `${label}.href`, { mailto: true });
    if (typeof link?.brand !== "string" || !/^#[0-9a-f]{6}$/i.test(link.brand)) {
      fail(`${label}.brand must be a six-digit hex color.`);
    }
  }
}

if (!Array.isArray(site.navigation)) {
  fail("site.navigation must be an array.");
} else {
  for (const [index, item] of site.navigation.entries()) {
    const label = `site.navigation[${index}]`;
    requireText(item?.label, `${label}.label`);
    validateHref(item?.href, `${label}.href`, { hash: true });
    if (item?.sectionId !== null && typeof item?.sectionId !== "string") {
      fail(`${label}.sectionId must be a string or null.`);
    }
    if (typeof item?.href === "string" && item.href.startsWith("#") && !item.sectionId) {
      warn(`${label} uses a hash link without sectionId, so active navigation cannot track it.`);
    }
    if (item?.newTab !== undefined && typeof item.newTab !== "boolean") {
      fail(`${label}.newTab must be boolean when provided.`);
    }
    if (item?.demoOnly !== undefined && typeof item.demoOnly !== "boolean") {
      fail(`${label}.demoOnly must be boolean when provided.`);
    }
  }
}

if (!Array.isArray(hero.greetings) || hero.greetings.length === 0) {
  fail("hero.greetings must contain at least one greeting.");
}
if (!Array.isArray(hero.portraits) || hero.portraits.length === 0) {
  fail("hero.portraits must contain at least one portrait.");
}
for (const groupName of ["roleLine", "summary"]) {
  const segments = hero[groupName];
  if (!Array.isArray(segments) || segments.length === 0) {
    fail(`hero.${groupName} must contain at least one segment.`);
    continue;
  }
  for (const [index, segment] of segments.entries()) {
    const label = `hero.${groupName}[${index}]`;
    const hasText = typeof segment?.text === "string";
    const hasBrand = Boolean(segment?.brand && typeof segment.brand.name === "string");
    if (hasText === hasBrand) fail(`${label} must contain exactly one of text or brand.`);
    if (segment?.brand?.icon) addAsset(segment.brand.icon, `${label}.brand.icon`);
  }
}

if (!Array.isArray(portfolio.projects)) fail("projects must be an array.");
if (!Array.isArray(photography.images)) fail("photography.images must be an array.");
if (!Array.isArray(about.timeline)) fail("about.timeline must be an array.");
if (!Array.isArray(about.story)) fail("about.story must be an array.");
if (!Array.isArray(about.galleryImages)) fail("about.galleryImages must be an array.");
const projects = Array.isArray(portfolio.projects) ? portfolio.projects : [];
const photos = Array.isArray(photography.images) ? photography.images : [];
const portraits = Array.isArray(hero.portraits) ? hero.portraits : [];
const galleryImages = Array.isArray(about.galleryImages) ? about.galleryImages : [];
requireText(seo.description, "seo.description");
if (!Array.isArray(seo.keywords) || seo.keywords.some((item) => typeof item !== "string" || !item.trim())) {
  fail("seo.keywords must be an array of non-empty strings.");
}
if (!Array.isArray(seo.knowsAbout) || seo.knowsAbout.some((item) => typeof item !== "string" || !item.trim())) {
  fail("seo.knowsAbout must be an array of non-empty strings.");
}

addAsset(siteAssets.socialPreview, "site.assets.socialPreview");
addAsset(siteAssets.icon, "site.assets.icon");
addAsset(siteAssets.appleTouchIcon, "site.assets.appleTouchIcon");
if (typeof siteAssets.socialPreview === "string" && /\.svg(?:[?#]|$)/i.test(siteAssets.socialPreview)) {
  warn("site.assets.socialPreview is SVG; use PNG, JPEG, or WebP before publishing for broad social-crawler compatibility.");
}
if (typeof siteAssets.appleTouchIcon === "string" && /\.svg(?:[?#]|$)/i.test(siteAssets.appleTouchIcon)) {
  warn("site.assets.appleTouchIcon is SVG; use a 180x180 PNG before publishing for broad Apple touch-icon compatibility.");
}
if (features.resume) {
  addAsset(resume.image, "site.resume.image");
  addAsset(resume.pdf, "site.resume.pdf");
  if (typeof resume.downloadName !== "string" || !/\.pdf$/i.test(resume.downloadName)) {
    fail("site.resume.downloadName must end in .pdf.");
  }
}
for (const [index, src] of portraits.entries()) addAsset(src, `hero.portraits[${index}]`);
for (const [index, src] of galleryImages.entries()) addAsset(src, `about.galleryImages[${index}]`);
if (features.photography) {
  if (photos.length === 0) warn("Photography is enabled but photography.images is empty.");
  for (const [index, src] of photos.entries()) addAsset(src, `photography.images[${index}]`);
}

const ids = new Set();
const enabledProjects = projects.filter((project) => project?.enabled);
if (features.work && enabledProjects.length === 0) warn("Work is enabled but no projects are enabled.");
for (const [index, project] of projects.entries()) {
  const label = `projects[${index}]`;
  requireText(project?.id, `${label}.id`);
  requireText(project?.name, `${label}.name`);
  requireText(project?.date, `${label}.date`);
  requireText(project?.description, `${label}.description`);
  if (typeof project?.enabled !== "boolean") fail(`${label}.enabled must be boolean.`);
  if (!projectLayouts.has(project?.layout)) fail(`${label}.layout is not supported.`);
  if (project?.featuredOnMobile !== undefined && typeof project.featuredOnMobile !== "boolean") {
    fail(`${label}.featuredOnMobile must be boolean when provided.`);
  }
  if (ids.has(project?.id)) fail(`Duplicate project id: ${project.id}`);
  if (project?.id) ids.add(project.id);

  const actions = Array.isArray(project?.actions) ? project.actions : [];
  if (project?.actions !== undefined && !Array.isArray(project.actions)) {
    fail(`${label}.actions must be an array when provided.`);
  }
  for (const [actionIndex, action] of actions.entries()) {
    requireText(action?.label, `${label}.actions[${actionIndex}].label`);
    validateHref(action?.href, `${label}.actions[${actionIndex}].href`);
  }
  if (project?.badge?.href) validateHref(project.badge.href, `${label}.badge.href`);
  validateSize(project?.image?.desktopSize, `${label}.image.desktopSize`);
  validateSize(project?.image?.mobileSize, `${label}.image.mobileSize`);
  validateSize(project?.story?.imageSize, `${label}.story.imageSize`);

  if (!project?.enabled) continue;
  const hasImage = Boolean(project.image?.desktop && project.image?.mobile);
  const carouselImages = Array.isArray(project.carouselImages) ? project.carouselImages : [];
  if (project?.carouselImages !== undefined && !Array.isArray(project.carouselImages)) {
    fail(`${label}.carouselImages must be an array when provided.`);
  }
  const hasCarousel = carouselImages.length > 0;
  if (!hasImage && !hasCarousel) fail(`${label} (${project.name}) needs image or carouselImages.`);
  if (project.layout === "carousel" && !hasCarousel) fail(`${label} uses carousel layout but carouselImages is empty.`);
  if (project.layout === "story" && !project.story) warn(`${label} uses story layout without a story block.`);
  addAsset(project.icon, `${label}.icon`);
  addAsset(project.image?.desktop, `${label}.image.desktop`);
  addAsset(project.image?.mobile, `${label}.image.mobile`);
  for (const [slideIndex, src] of carouselImages.entries()) {
    addAsset(src, `${label}.carouselImages[${slideIndex}]`);
  }
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
  console.log(
    `Portfolio content OK — ${enabledProjects.length} enabled projects, ${(photography.images ?? []).length} photos, ${foundAssets} local assets verified.`,
  );
}
