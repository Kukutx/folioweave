import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "portfolio.json");
const portfolio = JSON.parse(fs.readFileSync(configPath, "utf8"));
const useDefaults = process.argv.includes("--defaults");
const rl = useDefaults ? null : createInterface({ input, output });

const ask = async (label, current = "") => {
  if (useDefaults) return current;
  const suffix = current ? ` [${current}]` : "";
  const value = (await rl.question(`${label}${suffix}: `)).trim();
  return value || current;
};
const yes = async (label, current = true) => {
  if (useDefaults) return current;
  const hint = current ? "Y/n" : "y/N";
  const value = (await rl.question(`${label} [${hint}]: `)).trim().toLowerCase();
  if (!value) return current;
  return value === "y" || value === "yes";
};
const socialByIcon = (icon) => portfolio.site.socialLinks.find((item) => item.icon === icon)?.href ?? "";

async function resolveLocation(city, country) {
  try {
    const query = new URLSearchParams({ name: city, count: "10", language: "en", format: "json" });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${query}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const candidates = Array.isArray(data.results) ? data.results : [];
    const countryNeedle = country.toLowerCase();
    return (
      candidates.find((item) => String(item.country ?? "").toLowerCase() === countryNeedle) ??
      candidates[0] ??
      null
    );
  } catch {
    return null;
  }
}

function initialsFor(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "ME";
}

function writePlaceholder(initials) {
  const dir = path.join(root, "public", "portfolio", "profile");
  fs.mkdirSync(dir, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1440"><rect width="1200" height="1440" fill="#e9e9e9"/><circle cx="600" cy="570" r="230" fill="#c9c9c9"/><rect x="250" y="850" width="700" height="420" rx="210" fill="#c9c9c9"/><text x="600" y="1320" text-anchor="middle" font-family="Arial,sans-serif" font-size="72" fill="#777">${initials}</text></svg>`;
  fs.writeFileSync(path.join(dir, "portrait-placeholder.svg"), svg);
}

console.log("\nFolioWeave personalization\n");
console.log("This updates portfolio.json only. Components and layout stay untouched.\n");

const current = portfolio.site.identity;
const name = await ask("Display name", current.name);
const firstName = await ask("First name", current.firstName || name.split(/\s+/)[0]);
const initials = await ask("Initials / logo text", current.initials || initialsFor(name));
const role = await ask("Role", current.role);
const company = await ask("Company or studio (optional)", current.company);
const city = await ask("City", portfolio.site.location.city);
const country = await ask("Country", portfolio.site.location.country);
const email = await ask("Contact email", portfolio.site.contact.email);
const origin = await ask("Production URL", portfolio.site.origin);
const locale = await ask("Locale", current.locale || "en-US");
const intro = await ask(
  "Short intro",
  `${role}${company ? ` at ${company}` : ""}, based in ${country}.`,
);

console.log("\nSocial links — leave blank to omit one.");
const twitter = await ask("X / Twitter URL", socialByIcon("twitter"));
const linkedin = await ask("LinkedIn URL", socialByIcon("linkedin"));
const instagram = await ask("Instagram URL", socialByIcon("instagram"));
const github = await ask("GitHub URL", socialByIcon("github"));
const website = await ask("Other website URL", socialByIcon("website"));
const cleanStart = await yes("Start from a clean portfolio (hide bundled demo content)?", true);

const geo = await resolveLocation(city, country);
if (geo) console.log(`\nLocation matched: ${geo.name}, ${geo.country} (${geo.timezone})`);
else console.log("\nCould not auto-resolve location; keeping the existing coordinates/time zone.");

portfolio.site.identity = { ...portfolio.site.identity, name, firstName, initials, role, company, country, locale };
portfolio.site.origin = origin.replace(/\/$/, "");
portfolio.site.contact = {
  email,
  helloSubject: `Hello ${firstName}!`,
  hiSubject: `Hi ${firstName}`,
};
portfolio.site.copyrightYear = new Date().getFullYear();
portfolio.site.location = {
  ...portfolio.site.location,
  city,
  country,
  ...(geo
    ? {
        latitude: geo.latitude,
        longitude: geo.longitude,
        timeZone: geo.timezone,
        timeZoneLabel: geo.timezone_abbreviation || portfolio.site.location.timeZoneLabel,
      }
    : {}),
};

const socialLinks = [
  twitter && { label: "Twitter", icon: "twitter", href: twitter, brand: "#000000" },
  linkedin && { label: "LinkedIn", icon: "linkedin", href: linkedin, brand: "#0A66C2" },
  instagram && { label: "Instagram", icon: "instagram", href: instagram, brand: "#E1306C" },
  github && { label: "GitHub", icon: "github", href: github, brand: "#181717" },
  website && { label: "Website", icon: "website", href: website, brand: "#111827" },
  { label: "Email", icon: "email", href: `mailto:${email}`, brand: "#EA4335" },
].filter(Boolean);
portfolio.site.socialLinks = socialLinks;
try {
  const handle = new URL(twitter).pathname.split("/").filter(Boolean)[0];
  portfolio.site.twitterHandle = handle ? `@${handle}` : "";
} catch {
  portfolio.site.twitterHandle = "";
}

portfolio.hero.roleLine = [{ text: company ? `${role} at ${company}` : role }];
portfolio.hero.summary = [{ text: intro }];
portfolio.seo.description = `${name} — ${role}${company ? ` at ${company}` : ""}, based in ${country}. Portfolio, selected work, and experiments.`;
portfolio.seo.keywords = [name, role, `${role} portfolio`, `${role} ${country}`, "portfolio"];
portfolio.seo.caseStudiesDescription = `Selected work and case studies by ${name}, ${role}.`;

for (const dir of ["profile", "photography", "projects", "resume"]) {
  fs.mkdirSync(path.join(root, "public", "portfolio", dir), { recursive: true });
}

if (cleanStart) {
  writePlaceholder(initials);
  portfolio.hero.portraits = ["/portfolio/profile/portrait-placeholder.svg"];
  portfolio.about.timeline = [];
  portfolio.about.story = [];
  portfolio.about.galleryImages = [];
  portfolio.photography.images = [];
  portfolio.projects = portfolio.projects.map((project) => ({ ...project, enabled: false }));
  portfolio.features.about = false;
  portfolio.features.work = false;
  portfolio.features.photography = false;
  portfolio.features.resume = false;
  portfolio.site.resume.enabled = false;
  portfolio.features.demoRoutes = false;
  portfolio.site.navigation = portfolio.site.navigation.filter(
    (item) => item.sectionId !== "about" && item.sectionId !== "work" && item.sectionId !== "photography" && item.href !== "/blogs",
  );
}

fs.writeFileSync(configPath, `${JSON.stringify(portfolio, null, 2)}\n`, "utf8");
rl?.close();

console.log("\n✓ portfolio.json updated");
console.log("✓ public/portfolio/{profile,photography,projects,resume} is ready");
console.log("\nNext:");
console.log("  1. Put your files under public/portfolio/");
console.log("  2. Edit portfolio.json to add projects/photos and enable sections");
console.log("  3. Run npm run content:check");
console.log("  4. Run npm run dev\n");
