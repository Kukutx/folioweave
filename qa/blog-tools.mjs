import assert from "node:assert/strict";

/** Runs against the active template's published index; never edits content. */
export async function checkBlogTools(page, base) {
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 320, height: 640 },
      { width: 480, height: 320 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`${base}/blogs`, { waitUntil: "networkidle" });
      const trigger = page.locator("[data-blog-search]");
      await trigger.waitFor();
      assert.equal(await page.locator("[data-blog-back-to-top]").count(), 0);
      const title = await page.locator(".blog-card-link").first().textContent();
      const article = await page
        .locator(".blog-card-link")
        .first()
        .getAttribute("href");
      const bounds = await trigger.boundingBox();
      assert.equal(viewport.height - bounds.y - bounds.height, 16);
      assert.ok(
        bounds.height >= 44,
        "same bottom spacing and minimum target as Home",
      );
      const music = page.locator('[data-plugin="music"]');
      if (await music.count()) {
        const box = await music.boundingBox();
        assert.ok(
          box.y + box.height <= bounds.y || box.x + box.width <= bounds.x,
          "native search does not overlap preview music",
        );
      }
      const scroll = await page.evaluate(() => ({
        y: scrollY,
        overflow: document.body.style.overflow,
      }));
      await trigger.click();
      const dialog = page.locator("[data-blog-search-panel][open]");
      await dialog.waitFor();
      const input = dialog.locator('input[type="search"]');
      assert.equal(
        await input.evaluate((el) => el === document.activeElement),
        true,
      );
      const panel = await dialog.boundingBox();
      if (viewport.width > 600 && viewport.height > 480) {
        assert.ok(
          Math.abs(panel.x + panel.width - bounds.x - bounds.width) < 1,
          "search panel shares the trigger's right edge, including tablet widths",
        );
      }
      assert.ok(
        panel.x >= 0 &&
          panel.y >= 0 &&
          panel.x + panel.width <= viewport.width &&
          panel.y + panel.height <= viewport.height,
        "dialog fits small/short viewports",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const clear = dialog.getByRole("button", {
        name: /Clear search|清空搜索/,
      });
      await input.fill("__no_such_blog_6f983d__");
      assert.equal(await dialog.locator("a[href]").count(), 0);
      assert.match(await dialog.getByRole("status").textContent(), /0/);
      await clear.click();
      assert.equal(await input.inputValue(), "");
      await input.fill(title.trim().split(/\s+/u)[0]);
      assert.ok(await dialog.locator(`a[href="${article}"]`).count());
      await input.dispatchEvent("compositionstart");
      await input.press("Enter");
      assert.ok(await dialog.isVisible(), "IME confirmation does not navigate");
      await input.dispatchEvent("compositionend");
      // Native modal plus wrapping keeps Tab on the controls, including results.
      const controls = dialog.locator("button, input, a[href]");
      await controls.last().focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await controls.first().evaluate((el) => el === document.activeElement),
        true,
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await controls.last().evaluate((el) => el === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert.equal(
        await trigger.evaluate((el) => el === document.activeElement),
        true,
      );
      assert.deepEqual(
        await page.evaluate(() => ({
          y: scrollY,
          overflow: document.body.style.overflow,
        })),
        scroll,
      );
      await trigger.click();
      await dialog.waitFor();
      assert.equal(
        await input.inputValue(),
        title.trim().split(/\s+/u)[0],
        "query survives closing and reopening",
      );
      await page.mouse.click(2, 2);
      await dialog.waitFor({ state: "detached" });
      assert.equal(
        await trigger.evaluate((el) => el === document.activeElement),
        true,
      );
      await trigger.click();
      await dialog.locator(`a[href="${article}"]`).click();
      await page.waitForURL(`${base}${article}`);
      assert.equal(
        await page.locator("[data-blog-search]").count(),
        0,
        "search exists only on the blog index",
      );
      assert.equal(await page.locator("[data-blog-search-panel]").count(), 0);
      assert.equal(
        await page.evaluate(() => document.body.style.overflow),
        scroll.overflow,
      );
      await page.setViewportSize({ width: viewport.width, height: 500 });
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      const top = page.locator("[data-blog-back-to-top]");
      await top.waitFor({ state: "detached" });
      const longEnough = await page.evaluate(
        () =>
          document.documentElement.scrollHeight - innerHeight >
          Math.max(420, innerHeight * 0.72),
      );
      assert.ok(
        longEnough,
        "article fixture is long enough to test return-to-top",
      );
      await page.evaluate(() =>
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "instant",
        }),
      );
      await top.waitFor();
      await top.click();
      await page.waitForFunction(() => scrollY === 0);
      await top.waitFor({ state: "detached" });
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: native blog search at 5 viewports; panel alignment; matching/empty/clear; IME, Tab/Escape, outside close, focus/scroll restoration; article navigation and back-to-top.",
    );
  } finally {
    page.off("pageerror", onError);
  }
}
