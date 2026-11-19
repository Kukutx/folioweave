import { resolveChromePath } from "./chrome.mjs";
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import { loadQaProfile } from "./profile.mjs";
import { installServiceFixtures } from "./service-fixtures.mjs";
import { qaTemplate } from "./template.mjs";

// What a shop's visitor relies on, read from the profile's store block rather
// than from one shop's copy: every location with its address and directions,
// one-tap chat and call to the shop's own numbers, the products and services
// pages, a 404 that leads back, and a small-screen menu that works.
const base = process.env.BASE_URL || "http://127.0.0.1:4181";
const chrome = resolveChromePath();
const portfolio = loadQaProfile();
const template = qaTemplate(portfolio);
const store = portfolio.store;
const contact = store.contact ?? {};
const results = [];

const assert = (value, message) => {
  if (!value) throw new Error(message);
};
/** Text as a reader meets it, whatever the markup splits it into. */
const plain = (text) =>
  String(text ?? "")
    .replace(/[\s  ]+/g, " ")
    .trim();

async function test(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(
      `PASS ${name}${detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""}`,
    );
  } catch (error) {
    results.push({ name, ok: false, error: String(error) });
    console.log(`FAIL ${name} :: ${error}`);
  }
}

const chatBase = contact.whatsapp
  ? `https://wa.me/${contact.whatsapp.replace(/^\+/, "")}`
  : null;
const phones = new Set(
  [contact.phone, ...store.locations.map((location) => location.phone)]
    .filter(Boolean)
    .map((phone) => `tel:${phone}`),
);
const pageFor = (block) =>
  template.pages.find((page) => page.requires === `store.${block}`);
const catalogPage = pageFor("catalog");
const servicesPage = pageFor("services");

/** Every link on the page, with what decides where and how it opens. */
const links = (page) =>
  page.locator("a[href]").evaluateAll((anchors) =>
    anchors.map((anchor) => ({
      href: anchor.getAttribute("href"),
      text: anchor.textContent,
      target: anchor.getAttribute("target"),
      rel: anchor.getAttribute("rel") ?? "",
    })),
  );
const opensSafely = (link) =>
  link.target === "_blank" &&
  ["noopener", "noreferrer"].every((value) => link.rel.split(/\s+/).includes(value));

/** Chat and call links lead only to the shop's own numbers, and chat opens
 * in a new tab without handing it the page. */
function checkContactLinks(all, where) {
  const chats = all.filter((link) => link.href.startsWith("https://wa.me/"));
  const calls = all.filter((link) => link.href.startsWith("tel:"));
  if (chatBase) {
    assert(chats.length > 0, `${where}: no chat link`);
    for (const link of chats) {
      assert(
        link.href === chatBase || link.href.startsWith(`${chatBase}?text=`),
        `${where}: chat link to another number: ${link.href}`,
      );
      assert(opensSafely(link), `${where}: chat link ${link.href} opens unsafely`);
    }
  } else assert(chats.length === 0, `${where}: chat link without a WhatsApp number`);
  if (phones.size) {
    assert(calls.length > 0, `${where}: no call link`);
    for (const link of calls)
      assert(phones.has(link.href), `${where}: call link to another number: ${link.href}`);
  } else assert(calls.length === 0, `${where}: call link without a phone number`);
  return { chat: chats.length, call: calls.length };
}

async function waitForHydration(page, selector) {
  await page.waitForFunction(
    (value) => {
      const element = document.querySelector(value);
      return Boolean(
        element &&
          Object.keys(element).some(
            (key) =>
              key.startsWith("__reactProps$") || key.startsWith("__reactFiber$"),
          ),
      );
    },
    selector,
    { timeout: 10_000 },
  );
}

/** Same-origin failures and console errors, collected for one page. */
function watch(page) {
  const problems = [];
  page.on("response", (response) => {
    if (response.url().startsWith(base) && response.status() >= 400)
      problems.push(`${response.status()} ${response.url()}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(String(error)));
  return problems;
}

async function sectionInView(page, id) {
  await page.waitForFunction(
    (value) => {
      const box = document.getElementById(value)?.getBoundingClientRect();
      return Boolean(box) && box.top > -2 && box.top < innerHeight / 2;
    },
    id,
    { timeout: 6000 },
  );
}

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--disable-gpu", "--disable-extensions", "--no-first-run"],
});
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installServiceFixtures(desktop, portfolio, base);
  const page = await desktop.newPage();
  const problems = watch(page);
  const response = await page.goto(base, { waitUntil: "networkidle" });
  const home = await links(page);

  await test("home names the shop and says what it offers", async () => {
    assert(response?.status() === 200, `status ${response?.status()}`);
    const heading = plain(await page.locator("h1").first().textContent());
    assert(
      heading.includes(plain(portfolio.site.identity.name)),
      `the main heading reads "${heading}"`,
    );
    const body = plain(await page.locator("main").textContent());
    for (const text of [store.tagline, ...(portfolio.hero.summary ?? []).map((part) => part.text)])
      if (text) assert(body.includes(plain(text)), `missing "${text}"`);
    return { heading };
  });

  await test("home chat and call links reach the shop", async () =>
    checkContactLinks(home, "home"));

  await test("quick questions open a chat with their message written", async () => {
    const actions = template.options.quickActions;
    if (!chatBase || !actions?.length) return { configured: 0 };
    for (const action of actions) {
      const href = `${chatBase}?text=${encodeURIComponent(action.message)}`;
      const link = home.find((item) => item.href === href);
      assert(link, `no chat link for "${action.title}"`);
      assert(plain(link.text).includes(plain(action.title)), `"${action.title}" is not on its link`);
    }
    return { actions: actions.length };
  });

  await test("every location shows its address, photo and directions", async () => {
    const section = page.locator("#stores");
    assert((await section.count()) === 1, "no stores section");
    const text = plain(await section.textContent());
    const checked = [];
    for (const location of store.locations) {
      for (const value of [location.name, location.city, location.street, location.tagline])
        if (value) assert(text.includes(plain(value)), `${location.id}: missing "${value}"`);
      if (location.street) {
        const city = encodeURIComponent(location.city);
        const directions = home.find(
          (link) => link.href.startsWith("https://www.google.com/maps/") && link.href.includes(city),
        );
        assert(directions, `${location.id}: no directions link`);
        assert(opensSafely(directions), `${location.id}: directions open unsafely`);
      }
      if (location.image) {
        const image = section.locator(`img[alt="${(location.imageAlt ?? "").replaceAll('"', '\\"')}"]`);
        assert((await image.count()) === 1, `${location.id}: photo or its description missing`);
        await image.scrollIntoViewIfNeeded();
        assert(
          await image.evaluate((img) => img.decode().then(() => img.naturalWidth > 0, () => false)),
          `${location.id}: photo does not load`,
        );
      }
      for (const link of location.links ?? []) {
        const found = home.find((item) => item.href === link.href);
        assert(found && opensSafely(found), `${location.id}: link ${link.href} missing or unsafe`);
      }
      checked.push(location.id);
    }
    return { locations: checked };
  });

  await test("home leads to the products and services pages", async () => {
    const pages = [catalogPage, servicesPage].filter(Boolean);
    for (const target of pages)
      assert(home.some((link) => link.href === target.href), `no link to ${target.href}`);
    return { pages: pages.map((target) => target.href) };
  });

  await test("social links open in a new tab", async () => {
    for (const link of contact.links ?? []) {
      const found = home.find((item) => item.href === link.href);
      assert(found, `missing ${link.href}`);
      assert(opensSafely(found), `${link.href} opens unsafely`);
    }
    return { links: (contact.links ?? []).length };
  });

  await test("section links bring their section into view", async () => {
    const navigation = page.locator("header nav a[href*='#']");
    const count = await navigation.count();
    assert(count > 0, "the header has no section links");
    const visited = [];
    for (let index = 0; index < count; index++) {
      const link = navigation.nth(index);
      const id = new URL(await link.getAttribute("href"), base).hash.slice(1);
      await link.click();
      await sectionInView(page, id);
      assert(new URL(page.url()).hash === `#${id}`, `the address does not name #${id}`);
      visited.push(id);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    return { sections: visited };
  });

  await test("no same-origin failures or console errors on the home page", async () => {
    assert(problems.length === 0, JSON.stringify(problems));
    return true;
  });

  if (catalogPage)
    await test(`products page ${catalogPage.href} lists every category`, async () => {
      const catalog = store.catalog;
      const pageProblems = watch(page);
      const reply = await page.goto(base + catalogPage.href, { waitUntil: "networkidle" });
      assert(reply?.status() === 200, `status ${reply?.status()}`);
      const heading = plain(await page.locator("h1").first().textContent());
      assert(heading === plain(catalog.title), `heading "${heading}"`);
      const text = plain(await page.locator("main").textContent());
      for (const category of catalog.categories)
        assert(text.includes(plain(category.name)), `missing category "${category.name}"`);
      const all = await links(page);
      assert(all.some((link) => link.href === "/"), "no way back to the home page");
      const contactLinks = checkContactLinks(all, catalogPage.href);
      assert(pageProblems.length === 0, JSON.stringify(pageProblems));
      return { categories: catalog.categories.length, ...contactLinks };
    });

  if (servicesPage)
    await test(`services page ${servicesPage.href} shows every price and step`, async () => {
      const services = store.services;
      const pageProblems = watch(page);
      const reply = await page.goto(base + servicesPage.href, { waitUntil: "networkidle" });
      assert(reply?.status() === 200, `status ${reply?.status()}`);
      const heading = plain(await page.locator("h1").first().textContent());
      assert(heading === plain(services.title), `heading "${heading}"`);
      const text = plain(await page.locator("main").textContent());
      let items = 0;
      for (const group of services.groups) {
        assert(text.includes(plain(group.name)), `missing group "${group.name}"`);
        for (const item of group.items) {
          assert(text.includes(plain(item.name)), `missing "${item.name}"`);
          if (item.price)
            assert(text.includes(plain(item.price)), `missing the price of "${item.name}"`);
          items++;
        }
      }
      for (const step of template.options.steps ?? [])
        assert(text.includes(plain(step.title)), `missing step "${step.title}"`);
      const all = await links(page);
      assert(all.some((link) => link.href === "/"), "no way back to the home page");
      const contactLinks = checkContactLinks(all, servicesPage.href);
      assert(pageProblems.length === 0, JSON.stringify(pageProblems));
      return { groups: services.groups.length, items, ...contactLinks };
    });

  await test("a missing page answers 404 and leads back", async () => {
    const reply = await page.goto(`${base}/__qa_missing_page__`, { waitUntil: "domcontentloaded" });
    assert(reply?.status() === 404, `status ${reply?.status()}`);
    assert(
      (await page.locator('meta[name="robots"][content*="noindex"]').count()) > 0,
      "a missing page may be indexed",
    );
    assert((await page.locator("h1").count()) === 1, "no single heading");
    const all = await links(page);
    assert(all.some((link) => link.href === "/"), "no way back to the home page");
    return checkContactLinks(all, "404");
  });
  await desktop.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installServiceFixtures(phone, portfolio, base);
  const mobile = await phone.newPage();
  const mobileProblems = watch(mobile);
  await mobile.goto(base, { waitUntil: "networkidle" });

  await test("small-screen menu opens, leads to a section and closes", async () => {
    const toggle = mobile.locator(template.menuToggle).first();
    assert(await toggle.isVisible(), "no visible menu button");
    await waitForHydration(mobile, template.menuToggle);
    await toggle.click();
    assert((await toggle.getAttribute("aria-expanded")) === "true", "the menu did not open");
    const menu = mobile.locator(`#${await toggle.getAttribute("aria-controls")}`);
    await menu.waitFor({ state: "visible", timeout: 3000 });
    const hrefs = await menu.locator("a").evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href")),
    );
    for (const target of [catalogPage, servicesPage].filter(Boolean))
      assert(hrefs.includes(target.href), `the menu has no link to ${target.href}`);
    await mobile.keyboard.press("Escape");
    assert((await toggle.getAttribute("aria-expanded")) === "false", "Escape did not close the menu");
    await toggle.click();
    const section = menu.locator('a[href$="#stores"]');
    assert((await section.count()) === 1, "the menu has no link to the stores");
    await section.click();
    await sectionInView(mobile, "stores");
    assert((await toggle.getAttribute("aria-expanded")) === "false", "the menu stayed open");
    return { links: hrefs };
  });

  await test("pages fit a small screen", async () => {
    const routes = ["/", ...template.pages.map((target) => target.href)];
    for (const route of routes) {
      await mobile.goto(base + route, { waitUntil: "networkidle" });
      assert(
        !(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)),
        `${route} scrolls sideways`,
      );
    }
    assert(mobileProblems.length === 0, JSON.stringify(mobileProblems));
    return { routes };
  });
  await phone.close();
} finally {
  await browser.close().catch(() => {});
}

const failed = results.filter((result) => !result.ok);
const summary = {
  template: template.id,
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed,
};
await fs.writeFile(
  "qa/functionality-report.json",
  JSON.stringify({ base, summary, results }, null, 2),
);
console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
process.exitCode = failed.length ? 1 : 0;
