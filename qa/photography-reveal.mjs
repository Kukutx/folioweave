import assert from "node:assert/strict";

const cards = "#photography [data-photo-reveal]";
const moveTo = (card, top = 230) =>
  card.evaluate((element, top) => {
    window.scrollTo({
      top: scrollY + element.getBoundingClientRect().top - top,
      behavior: "instant",
    });
  }, top);
const waitVisible = (page, index) =>
  page.waitForFunction(
    ({ cards, index }) => {
      const card = document.querySelectorAll(cards)[index];
      const image = card?.querySelector("img");
      return (
        image?.complete &&
        image.naturalWidth > 0 &&
        getComputedStyle(card).opacity === "1"
      );
    },
    { cards, index },
  );

/** The same checks run on the live preview and the isolated production build. */
export async function checkPhotographyReveal(page, base) {
  await page.emulateMedia({ reducedMotion: "no-preference", media: "screen" });
  for (const [width, columns] of [
    [2202, 3],
    [1440, 3],
    [800, 2],
    [390, 1],
  ]) {
    await page.setViewportSize({ width, height: width > 2000 ? 1086 : 900 });
    await page.goto(base, { waitUntil: "networkidle" });
    const photos = page.locator(cards);
    assert.ok(
      (await photos.count()) > columns * 2,
      "fixture has three photo rows",
    );
    assert.equal(
      await photos.first().getAttribute("data-photo-reveal"),
      "pending",
    );
    const later = photos.nth(columns * 2);
    // A cached/early-decoded image must still wait until it enters the viewport.
    await later.locator("img").evaluate(async (image) => {
      image.loading = "eager";
      await image.decode();
    });
    assert.equal(
      await later.evaluate((el) => getComputedStyle(el).opacity),
      "0",
    );
    await moveTo(photos.first());
    await Promise.all(
      Array.from({ length: columns }, (_, index) => waitVisible(page, index)),
    );
    assert.equal(await later.getAttribute("data-photo-reveal"), "pending");
    const delays = await photos.evaluateAll(
      (nodes, columns) =>
        nodes
          .slice(0, columns)
          .map((el) => parseFloat(getComputedStyle(el).transitionDelay)),
      columns,
    );
    assert.ok(
      delays.every((delay, index) => index === 0 || delay > delays[index - 1]),
      "same-row images enter with a short stagger",
    );
    const frame = await photos.first().evaluate((element) => {
      const outer = element.firstElementChild;
      const inner = outer.firstElementChild;
      const image = inner.querySelector("img");
      return {
        outerBackground: getComputedStyle(outer).backgroundColor,
        innerBackground: getComputedStyle(inner).backgroundColor,
        outerRadius: getComputedStyle(outer).borderRadius,
        innerRadius: getComputedStyle(inner).borderRadius,
        imageRadius: getComputedStyle(image).borderRadius,
      };
    });
    assert.deepEqual(
      frame,
      {
        outerBackground: "rgba(0, 0, 0, 0)",
        innerBackground: "rgba(0, 0, 0, 0)",
        outerRadius: "24px",
        innerRadius: "0px",
        imageRadius: "0px",
      },
      "a single round clip has no light matte underneath",
    );
    await moveTo(later);
    await waitVisible(page, columns * 2);
    await moveTo(photos.first());
    assert.equal(
      await photos.first().evaluate((el) => getComputedStyle(el).opacity),
      "1",
      "returning to a revealed row does not replay its entrance",
    );
    await photos.first().click();
    await page.getByRole("dialog", { name: "Photography viewer" }).waitFor();
    await page.keyboard.press("Escape");
    await page
      .getByRole("dialog", { name: "Photography viewer" })
      .waitFor({ state: "detached" });
    // Keep the browser's restored scroll position and selected image candidate.
    // Testing only a fresh 1440px page misses wider srcset variants and reloads.
    if (width > 2000) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await Promise.all(
        Array.from({ length: columns }, (_, index) => waitVisible(page, index)),
      );
    }
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base, { waitUntil: "networkidle" });
  await moveTo(page.locator(cards).first());
  await waitVisible(page, 0);
  assert.equal(
    await page
      .locator(cards)
      .first()
      .evaluate((el) => getComputedStyle(el).transform),
    "none",
  );
  await page.emulateMedia({ reducedMotion: "no-preference", media: "print" });
  assert.equal(
    await page
      .locator(cards)
      .last()
      .evaluate((el) => getComputedStyle(el).opacity),
    "1",
    "printing includes unrevealed photographs",
  );
  await page.emulateMedia({ reducedMotion: "no-preference", media: "screen" });

  const fallback = await page
    .context()
    .browser()
    .newContext({ javaScriptEnabled: false });
  try {
    const staticPage = await fallback.newPage();
    await staticPage.goto(base, { waitUntil: "domcontentloaded" });
    await moveTo(staticPage.locator(cards).first());
    assert.equal(
      await staticPage
        .locator(cards)
        .first()
        .evaluate((el) => getComputedStyle(el).opacity),
      "1",
    );
    assert.equal(
      await staticPage
        .locator(cards)
        .first()
        .locator("img")
        .evaluate((el) => getComputedStyle(el).opacity),
      "1",
      "server-rendered photography remains visible without JavaScript",
    );
  } finally {
    await fallback.close();
  }
  console.log(
    "PASS: photography reveals every image in 3/2/1 columns, wide-screen reload restores all columns, cached offscreen images wait, return/lightbox preserve visibility, transparent corners, reduced motion, print and no-JS fallback.",
  );
}
