import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";

const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const chrome = resolveChromePath();
const routes = [
  "/",
  "/blogs",
  "/blogs/clipt",
  "/brink",
  "/brink/privacy",
  "/case-studies",
  "/clipt",
  "/clipt-privacypolicy",
  "/district",
  "/flipfact",
  "/habee-privacypolicy",
  "/notchshelf-privacypolicy",
];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
});
const report = [];
const origin = new URL(base).origin;

for (const viewport of viewports) {
  for (const route of routes) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const badResponses = [];
    const thirdPartyRequests = new Set();

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("response", (response) => {
      if (response.url().startsWith(origin) && response.status() >= 400) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on("request", (request) => {
      try {
        const requestOrigin = new URL(request.url()).origin;
        if (requestOrigin !== origin && /^https?:/.test(request.url())) {
          thirdPartyRequests.add(request.url());
        }
      } catch {
        // Ignore non-URL browser-internal requests.
      }
    });

    const response = await page.goto(base + route, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(route === "/" ? 1200 : 500);
    const data = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map(
        (element) => element.id,
      );
      const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
      const unlabeledButtons = [
        ...document.querySelectorAll("button,[role='button']"),
      ]
        .filter((element) => {
          const text = element.textContent?.trim();
          return !text && !element.getAttribute("aria-label") && !element.getAttribute("title");
        })
        .map((element) => element.outerHTML.slice(0, 300));
      const imagesWithoutAlt = [...document.images]
        .filter((image) => !image.hasAttribute("alt"))
        .map((image) => image.getAttribute("src"));
      const unsafeBlankLinks = [...document.querySelectorAll('a[target="_blank"]')]
        .filter((link) => {
          const rel = new Set((link.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
          return !rel.has("noopener") || !rel.has("noreferrer");
        })
        .map((link) => link.outerHTML.slice(0, 300));
      const nonKeyboardRoleButtons = [...document.querySelectorAll('[role="button"]')]
        .filter((element) => !(element instanceof HTMLButtonElement) && element.tabIndex < 0)
        .map((element) => element.outerHTML.slice(0, 300));
      const canonical = document.querySelector("link[rel='canonical']")?.getAttribute("href") || "";
      const description = document.querySelector("meta[name='description']")?.getAttribute("content") || "";
      const manifest = document.querySelector("link[rel='manifest']")?.getAttribute("href") || "";
      const nestedVerticalScrollContainers = [...document.querySelectorAll("body *")]
        .filter((element) => {
          const style = getComputedStyle(element);
          return (
            ["auto", "scroll", "overlay"].includes(style.overflowY) &&
            element.scrollHeight > element.clientHeight + 1
          );
        })
        .map((element) => ({
          tag: element.tagName,
          id: element.id || "",
          className:
            typeof element.className === "string" ? element.className : "",
          overflowY: getComputedStyle(element).overflowY,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }));
      const hero = document.querySelector("#home.hero-section");
      const gallery = document.querySelector(".story-gallery");
      const homeScrollModel =
        hero && gallery
          ? {
              heroOverflowX: getComputedStyle(hero).overflowX,
              heroOverflowY: getComputedStyle(hero).overflowY,
              galleryOverflowX: getComputedStyle(gallery).overflowX,
              galleryOverflowY: getComputedStyle(gallery).overflowY,
              ok:
                getComputedStyle(hero).overflowX === "clip" &&
                getComputedStyle(hero).overflowY === "visible" &&
                getComputedStyle(gallery).overflowX === "auto" &&
                getComputedStyle(gallery).overflowY === "hidden",
            }
          : null;
      return {
        title: document.title,
        h1Count: document.querySelectorAll("h1").length,
        duplicateIds,
        unlabeledButtons,
        imagesWithoutAlt,
        unsafeBlankLinks,
        nonKeyboardRoleButtons,
        iframeCount: document.querySelectorAll("iframe").length,
        legacyRuntimeCount: [
          ...document.querySelectorAll("script[src]"),
        ].filter((script) => script.getAttribute("src")?.includes("index-1153efcc"))
          .length,
        horizontalOverflow:
          document.documentElement.scrollWidth > window.innerWidth + 1,
        canonical,
        description,
        manifest,
        nestedVerticalScrollContainers,
        homeScrollModel,
      };
    });

    const item = {
      viewport: viewport.name,
      route,
      status: response?.status() || 0,
      ...data,
      consoleErrors,
      pageErrors,
      badResponses,
      thirdPartyRequests: [...thirdPartyRequests],
    };
    report.push(item);
    const ok =
      item.status === 200 &&
      item.title.length > 0 &&
      item.h1Count >= 1 &&
      item.duplicateIds.length === 0 &&
      item.unlabeledButtons.length === 0 &&
      item.imagesWithoutAlt.length === 0 &&
      item.unsafeBlankLinks.length === 0 &&
      item.nonKeyboardRoleButtons.length === 0 &&
      item.iframeCount === 0 &&
      item.legacyRuntimeCount === 0 &&
      !item.horizontalOverflow &&
      (route !== "/" ||
        (item.nestedVerticalScrollContainers.length === 0 &&
          item.homeScrollModel?.ok === true)) &&
      item.canonical.length > 0 &&
      item.description.length > 0 &&
      item.manifest.length > 0 &&
      item.consoleErrors.length === 0 &&
      item.pageErrors.length === 0 &&
      item.badResponses.length === 0 &&
      item.thirdPartyRequests.length === 0;
    console.log(
      `${ok ? "PASS" : "FAIL"} ${viewport.name.padEnd(7)} ${route}`,
    );
    await context.close();
  }
}

const homeResponse = await fetch(base, { redirect: "manual" });
const headers = Object.fromEntries(homeResponse.headers.entries());
const security = {
  csp: headers["content-security-policy"] || "",
  permissionsPolicy: headers["permissions-policy"] || "",
  xContentTypeOptions: headers["x-content-type-options"] || "",
  xFrameOptions: headers["x-frame-options"] || "",
  referrerPolicy: headers["referrer-policy"] || "",
  hsts: headers["strict-transport-security"] || "",
  poweredBy: headers["x-powered-by"] || "",
};
const robots = await fetch(base + "/robots.txt");
const sitemap = await fetch(base + "/sitemap.xml");
const manifest = await fetch(base + "/manifest.webmanifest");
const notFound = await fetch(base + "/__quality_missing_route__");
const notFoundHtml = await notFound.text();
const notFoundOk =
  notFound.status === 404 &&
  notFoundHtml.includes("This page wandered off.") &&
  notFoundHtml.includes("noindex");
const endpointChecks = {
  robots: robots.status,
  sitemap: sitemap.status,
  manifest: manifest.status,
  notFound: notFound.status,
  notFoundOk,
};

await browser.close();

const failures = report.filter(
  (item) =>
    item.status !== 200 ||
    !item.title ||
    item.h1Count < 1 ||
    item.duplicateIds.length ||
    item.unlabeledButtons.length ||
    item.imagesWithoutAlt.length ||
    item.unsafeBlankLinks.length ||
    item.nonKeyboardRoleButtons.length ||
    item.iframeCount ||
    item.legacyRuntimeCount ||
    item.horizontalOverflow ||
    (item.route === "/" &&
      (item.nestedVerticalScrollContainers.length || !item.homeScrollModel?.ok)) ||
    !item.canonical ||
    !item.description ||
    !item.manifest ||
    item.consoleErrors.length ||
    item.pageErrors.length ||
    item.badResponses.length ||
    item.thirdPartyRequests.length,
);
const securityOk =
  security.csp.includes("default-src 'self'") &&
  security.permissionsPolicy.includes("camera=(self)") &&
  security.xContentTypeOptions === "nosniff" &&
  security.xFrameOptions === "DENY" &&
  security.referrerPolicy === "strict-origin-when-cross-origin" &&
  security.hsts.includes("max-age=") &&
  !security.poweredBy;
const endpointsOk =
  robots.status === 200 &&
  sitemap.status === 200 &&
  manifest.status === 200 &&
  notFoundOk;
const summary = {
  checks: report.length,
  passed: report.length - failures.length,
  failed: failures.length,
  securityOk,
  endpointsOk,
  endpointChecks,
};

await fs.writeFile(
  "qa/quality-report.json",
  JSON.stringify({ base, summary, security, failures, report }, null, 2),
);
console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
if (failures.length || !securityOk || !endpointsOk) process.exitCode = 1;
