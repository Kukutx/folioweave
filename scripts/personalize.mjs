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

const yes = async (label, current = true) => {
  if (useDefaults) return current;
  const hint = current ? "Y/n" : "y/N";
  const value = (await rl.question(`${label} [${hint}]: `)).trim().toLowerCase();
  if (!value) return current;
  return value === "y" || value === "yes";
};

const askRequired = async (label, current = "", fallback = "") => {
  if (useDefaults) return current || fallback;
  for (;;) {
    const suffix = current ? ` [${current}]` : "";
    const value = (await rl.question(`${label}${suffix}: `)).trim();
    const resolved = value || current || fallback;
    if (resolved) return resolved;
    console.log("  A value is required.");
  }
};

const askOptional = async (label, current = "") => {
  if (useDefaults) return current;
  const suffix = current ? ` [${current}]` : "";
  const value = (await rl.question(`${label}${suffix} (type - to clear): `)).trim();
  if (value === "-") return "";
  return value || current;
};

const socialByIcon = (icon) =>
  portfolio.site.socialLinks.find((item) => item.icon === icon)?.href ?? "";

async function resolveLocation(city, country) {
  try {
    const query = new URLSearchParams({
      name: city,
      count: "10",
      language: "en",
      format: "json",
    });
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
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "ME"
  );
}

function slugFor(value) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "portfolio"
  );
}

function writePlaceholderAssets(initials) {
  const dir = path.join(root, "public", "portfolio", "profile");
  fs.mkdirSync(dir, { recursive: true });
  const portrait = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1440"><rect width="1200" height="1440" fill="#e9e9e9"/><circle cx="600" cy="570" r="230" fill="#c9c9c9"/><rect x="250" y="850" width="700" height="420" rx="210" fill="#c9c9c9"/><text x="600" y="1320" text-anchor="middle" font-family="Arial,sans-serif" font-size="72" fill="#777">${initials}</text></svg>`;
  const socialPreview = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f3f3f3"/><text x="600" y="330" text-anchor="middle" font-family="Arial,sans-serif" font-size="128" font-weight="700" fill="#222">${initials}</text></svg>`;
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#f3f3f3"/><text x="256" y="300" text-anchor="middle" font-family="Arial,sans-serif" font-size="156" font-weight="700" fill="#222">${initials}</text></svg>`;
  fs.writeFileSync(path.join(dir, "portrait-placeholder.svg"), portrait);
  fs.writeFileSync(path.join(dir, "social-preview-placeholder.svg"), socialPreview);
  fs.writeFileSync(path.join(dir, "icon-placeholder.svg"), icon);
}

console.log("\nFolioWeave personalization\n");
console.log("This updates portfolio.json only. Components and layout stay untouched.\n");

const defaultCleanStart = portfolio.features?.demoRoutes !== false;
const cleanStart = await yes("Start from a clean portfolio (remove bundled demo content)?", defaultCleanStart);

const current = portfolio.site.identity;
const defaults = cleanStart
  ? {
      name: "Your Name",
      firstName: "You",
      initials: "ME",
      role: "Creative Professional",
      company: "",
      city: "Your City",
      country: "Your Country",
      email: "hello@example.com",
      origin: "https://example.com",
      locale: "en-US",
      twitter: "",
      linkedin: "",
      instagram: "",
      github: "",
      website: "",
    }
  : {
      name: current.name,
      firstName: current.firstName,
      initials: current.initials,
      role: current.role,
      company: current.company,
      city: portfolio.site.location.city,
      country: portfolio.site.location.country,
      email: portfolio.site.contact.email,
      origin: portfolio.site.origin,
      locale: current.locale || "en-US",
      twitter: socialByIcon("twitter"),
      linkedin: socialByIcon("linkedin"),
      instagram: socialByIcon("instagram"),
      github: socialByIcon("github"),
      website: socialByIcon("website"),
    };

const name = await askRequired("Display name", cleanStart ? "" : defaults.name, defaults.name);
const firstName = await askRequired(
  "First name",
  cleanStart ? "" : defaults.firstName,
  cleanStart ? name.split(/\s+/)[0] || defaults.firstName : defaults.firstName,
);
const initials = await askRequired(
  "Initials / logo text",
  cleanStart ? "" : defaults.initials,
  cleanStart ? initialsFor(name) : defaults.initials,
);
const role = await askRequired("Role", cleanStart ? "" : defaults.role, defaults.role);
const company = await askOptional("Company or studio", cleanStart ? "" : defaults.company);
const city = await askRequired("City", cleanStart ? "" : defaults.city, defaults.city);
const country = await askRequired("Country", cleanStart ? "" : defaults.country, defaults.country);
const email = await askRequired("Contact email", cleanStart ? "" : defaults.email, defaults.email);
const origin = await askRequired("Production URL", cleanStart ? "" : defaults.origin, defaults.origin);
const locale = await askRequired("Locale", cleanStart ? "" : defaults.locale, defaults.locale);
const intro = await askRequired(
  "Short intro",
  cleanStart ? "" : `${role}${company ? ` at ${company}` : ""}, based in ${country}.`,
  `${role}${company ? ` at ${company}` : ""}, based in ${country}.`,
);

console.log("\nSocial links — press Enter to keep the shown value; type - to remove it.");
const twitter = await askOptional("X / Twitter URL", defaults.twitter);
const linkedin = await askOptional("LinkedIn URL", defaults.linkedin);
const instagram = await askOptional("Instagram URL", defaults.instagram);
const github = await askOptional("GitHub URL", defaults.github);
const website = await askOptional("Other website URL", defaults.website);

const geo = await resolveLocation(city, country);
if (geo) {
  console.log(`\nLocation matched: ${geo.name}, ${geo.country} (${geo.timezone})`);
} else if (cleanStart) {
  console.log("\nCould not auto-resolve location; using UTC until you set valid coordinates/time zone.");
} else {
  console.log("\nCould not auto-resolve location; keeping the existing coordinates/time zone.");
}

portfolio.site.identity = {
  ...portfolio.site.identity,
  name,
  firstName,
  initials,
  role,
  company,
  locale,
};
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
    : cleanStart
      ? {
          latitude: 0,
          longitude: 0,
          timeZone: "Etc/UTC",
          timeZoneLabel: "UTC",
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

portfolio.hero.roleLine = [{ text: company ? `${role} at ${company}` : role }];
portfolio.hero.summary = [{ text: intro }];
portfolio.seo.description = `${name} — ${role}${company ? ` at ${company}` : ""}, based in ${country}. Portfolio, selected work, and experiments.`;
portfolio.seo.keywords = [name, role, `${role} portfolio`, `${role} ${country}`, "portfolio"];
portfolio.seo.knowsAbout = [role];
portfolio.seo.caseStudiesDescription = `Selected work and case studies by ${name}, ${role}.`;
delete portfolio.seo.award;

for (const dir of ["profile", "photography", "projects", "resume"]) {
  fs.mkdirSync(path.join(root, "public", "portfolio", dir), { recursive: true });
}

if (cleanStart) {
  const slug = slugFor(name);
  writePlaceholderAssets(initials);
  portfolio.hero.portraits = ["/portfolio/profile/portrait-placeholder.svg"];
  portfolio.about.timeline = [];
  portfolio.about.story = [];
  portfolio.about.galleryImages = [];
  portfolio.photography.images = [];
  portfolio.projects = [];
  portfolio.footerBook = {
    title: "NOTES",
    quote: "Thanks for stopping by.",
    author: firstName,
  };
  portfolio.features.about = false;
  portfolio.features.work = false;
  portfolio.features.photography = false;
  portfolio.features.resume = false;
  portfolio.features.demoRoutes = false;
  portfolio.features.weather = Boolean(geo);
  portfolio.site.resume = {
    image: "/portfolio/resume/resume.jpg",
    pdf: "/portfolio/resume/resume.pdf",
    downloadName: `${slug}-resume.pdf`,
  };
  portfolio.site.assets.socialPreview = "/portfolio/profile/social-preview-placeholder.svg";
  portfolio.site.assets.icon = "/portfolio/profile/icon-placeholder.svg";
  portfolio.site.assets.appleTouchIcon = "/portfolio/profile/icon-placeholder.svg";
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
