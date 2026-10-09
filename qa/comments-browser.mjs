import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { resolveChromePath } from "./chrome.mjs";
import { startCommentsPreview } from "./comments-preview.mjs";

const supplied = process.argv
  .find((value) => value.startsWith("--url="))
  ?.slice(6);
console.log(
  supplied
    ? "Checking running comments preview"
    : "Building isolated comments production preview…",
);
const preview = supplied
  ? null
  : await startCommentsPreview({ production: true });
const browser = await chromium.launch({
  executablePath: resolveChromePath(),
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
// Count actual entry date renders. This lives only in the test browser, and
// catches list work caused by typing without instrumenting production code.
await page.addInitScript(() => {
  window.commentDateRenders = 0;
  const descriptor = Object.getOwnPropertyDescriptor(
    Intl.DateTimeFormat.prototype,
    "format",
  );
  Object.defineProperty(Intl.DateTimeFormat.prototype, "format", {
    ...descriptor,
    get() {
      const format = descriptor.get.call(this);
      return (...args) => {
        window.commentDateRenders++;
        return format(...args);
      };
    },
  });
});
const errors = [];
const remote = [];
const writes = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (!request.url().startsWith(supplied ?? preview.url))
    remote.push(request.url());
  if (request.method() === "POST" && request.url().includes("/api/comment"))
    writes.push(request.postDataJSON());
});
const plugin = page.locator('[data-plugin="comments"][data-provider="waline"]');
const idle = async () => {
  await plugin.locator('[aria-busy="false"]').waitFor();
};
const open = async () => {
  await plugin.scrollIntoViewIfNeeded();
  const gate = plugin.getByRole("button", { name: "查看评论", exact: true });
  if (await gate.isVisible()) await gate.click();
  await plugin.locator("textarea").waitFor();
  await idle();
};
const chooseScenario = async (value) => {
  await page.getByLabel("演示状态").selectOption(value);
  await open();
};
const compose = async (body) => {
  await plugin.getByLabel("称呼", { exact: true }).fill("QA Reader");
  await plugin.locator("textarea").fill(body);
};
const waitText = (text) =>
  plugin.getByText(text, { exact: true }).first().waitFor();
const post = async () => {
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/comment"),
  );
  await plugin.getByRole("button", { name: "发表", exact: true }).click();
  await response;
};
const hottest = async () => {
  const response = page.waitForResponse((response) =>
    response.url().includes("sortBy=like_desc"),
  );
  await plugin.getByRole("button", { name: "热门", exact: true }).click();
  await response;
  await idle();
};
try {
  await page.goto(supplied ?? preview.url);
  await open();
  assert.equal(
    await plugin
      .locator("textarea")
      .evaluate((element) => getComputedStyle(element).minHeight),
    "108px",
    "the native shell must arrive with its scoped stylesheet",
  );
  await plugin.locator("[data-comment-id]").first().waitFor();
  assert.equal(
    await plugin.getByRole("button", { name: "登录", exact: true }).count(),
    0,
    "guest UI must be the default without a login option",
  );
  const rendersBeforeTyping = await page.evaluate(
    () => window.commentDateRenders,
  );
  await plugin
    .locator("textarea")
    .pressSequentially("Typing must leave existing comments alone.");
  assert.equal(
    await page.evaluate(() => window.commentDateRenders),
    rendersBeforeTyping,
    "typing must not re-render existing comments",
  );
  await plugin.locator("textarea").fill("");
  console.log("PASS default guest mode and no comment re-renders while typing");
  await page.getByLabel("加载方式").selectOption("manual");
  await plugin.getByRole("button", { name: "查看评论", exact: true }).waitFor();
  let gatedRequests = 0;
  const countGated = (request) => {
    if (request.url().includes("/api/comment")) gatedRequests++;
  };
  page.on("request", countGated);
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await page.getByRole("button", { name: "浅色", exact: true }).click();
  assert.equal(gatedRequests, 0, "manual gate must not contact provider");
  page.off("request", countGated);
  await open();
  console.log("PASS deferred loading and zero external embeds");

  const guestText = `Guest comment ${Date.now()}`;
  await compose(guestText);
  const before = writes.length;
  await post();
  await waitText(guestText);
  assert.equal(writes.length, before + 1, "one submission, no automatic retry");
  assert.equal(await plugin.locator("textarea").inputValue(), "");
  assert.equal(writes.at(-1).url, "standalone-comments-one");

  const root = plugin.locator('[data-comment-id="1"]');
  await hottest();
  await root.getByRole("button", { name: "回复", exact: true }).first().click();
  assert.equal(
    await plugin
      .locator("textarea")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  const replyText = `Reply comment ${Date.now()}`;
  await plugin.locator("textarea").fill(replyText);
  await post();
  await waitText(replyText);
  assert.equal(writes.at(-1).pid, "1");
  assert.equal(writes.at(-1).rid, "1");
  const like = root.getByRole("button", { name: "赞 · 林间", exact: true });
  const originalLikes = Number(await like.textContent());
  await like.click();
  const unlike = root.getByRole("button", {
    name: "取消赞 · 林间",
    exact: true,
  });
  await unlike.waitFor();
  assert.equal(Number(await unlike.textContent()), originalLikes + 1);
  const sorted = page.waitForResponse((response) =>
    response.url().includes("sortBy=like_desc"),
  );
  await plugin.getByRole("button", { name: "热门", exact: true }).click();
  await sorted;
  await idle();
  assert.equal(
    Number(await unlike.textContent()),
    originalLikes + 1,
    "refetch must not count the local like twice",
  );
  await unlike.click();
  await like.waitFor();
  assert.equal(Number(await like.textContent()), originalLikes);
  while (
    await plugin
      .getByRole("button", { name: "查看更多", exact: true })
      .isVisible()
  ) {
    const loaded = page.waitForResponse(
      (response) =>
        response.url().includes("/api/comment?") &&
        response.request().method() === "GET",
    );
    await plugin.getByRole("button", { name: "查看更多", exact: true }).click();
    await loaded;
    await idle();
  }
  const ids = await plugin
    .locator("[data-comment-id]")
    .evaluateAll((items) => items.map((item) => item.dataset.commentId));
  assert.equal(
    new Set(ids).size,
    ids.length,
    "pagination must not duplicate comments",
  );
  console.log(
    "PASS guest submit, threaded replies, likes, sorting and pagination",
  );

  await chooseScenario("submit-error");
  await compose("Keep this draft after a failed request");
  await post();
  await waitText("发表失败，输入的内容已保留。");
  assert.equal(
    await plugin.locator("textarea").inputValue(),
    "Keep this draft after a failed request",
  );
  await chooseScenario("moderated");
  await compose("Pending moderation comment");
  await post();
  await waitText("留言已提交，审核后公开显示。");
  await idle();
  assert.equal(
    await plugin
      .locator("[data-comment-id]")
      .filter({ hasText: "Pending moderation comment" })
      .count(),
    0,
  );
  let failLoad = true;
  await page.route("**/service/error/api/comment?*", async (route) => {
    if (failLoad) await route.fulfill({ status: 503, json: { errno: 503 } });
    else
      await route.fulfill({
        response: await route.fetch({
          url: route
            .request()
            .url()
            .replace("/service/error/", "/service/normal/"),
        }),
      });
  });
  await chooseScenario("error");
  await waitText("评论暂时无法加载，请稍后重试。");
  failLoad = false;
  await plugin.getByRole("button", { name: "重试", exact: true }).click();
  await idle();
  await plugin.locator("[data-comment-id]").first().waitFor();
  await page.unroute("**/service/error/api/comment?*");
  await chooseScenario("empty");
  await waitText("暂无评论");
  console.log(
    "PASS failed writes preserve input, moderation, empty state and load retry",
  );

  await chooseScenario("normal");
  await page.getByLabel("账号登录").selectOption("optional");
  await page.getByLabel("加载方式").selectOption("viewport");
  await open();
  await hottest();
  await plugin
    .locator('[data-comment-id="1"]')
    .getByRole("button", { name: "回复", exact: true })
    .first()
    .click();
  await compose("Draft survives same-tab login");
  await plugin.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("link", { name: "以演示用户继续" }).click();
  await open();
  await plugin.getByRole("button", { name: "退出", exact: true }).waitFor();
  assert.equal(
    new URL(page.url()).searchParams.has("token"),
    false,
    "return token must be removed from URL",
  );
  assert.equal(
    await plugin.locator("textarea").inputValue(),
    "Draft survives same-tab login",
  );
  assert.equal(
    await plugin.getByRole("button", { name: "取消回复" }).count(),
    1,
    "reply target must survive login",
  );
  await post();
  await waitText("Draft survives same-tab login");
  assert.equal(writes.at(-1).pid, "1");
  await plugin.getByRole("button", { name: "退出", exact: true }).click();
  await plugin.getByLabel("称呼", { exact: true }).waitFor();
  await page.getByLabel("账号登录").selectOption("disabled");
  await open();
  assert.equal(
    await plugin.getByRole("button", { name: "登录", exact: true }).count(),
    0,
  );
  console.log(
    "PASS optional login, URL cleanup, draft + reply restore and logout",
  );

  await compose("Must not cross article boundaries");
  await page.getByLabel("独立文章").selectOption("standalone-comments-two");
  await open();
  assert.equal(await plugin.locator("textarea").inputValue(), "");
  await waitText("暂无评论");
  const malicious =
    "**Safe bold**\n\n<script>window.commentsXss = true</script>\n\n[unsafe](javascript:alert(1)) ![tracking](https://tracking.invalid/pixel.png)\n\n[Safe link](https://example.com/)";
  await compose(malicious);
  await post();
  await plugin.locator("strong", { hasText: "Safe bold" }).waitFor();
  assert.equal(
    await plugin.locator('img,script,a[href^="javascript:"]').count(),
    0,
  );
  assert.equal(await page.evaluate(() => window.commentsXss), undefined);
  console.log("PASS article isolation and safe Markdown rendering");

  let releaseOld, sawOld;
  const held = new Promise((resolve) => {
    releaseOld = resolve;
  });
  const requested = new Promise((resolve) => {
    sawOld = resolve;
  });
  await page.route("**/service/normal/api/comment?*", async (route) => {
    if (
      new URL(route.request().url()).searchParams.get("path") !==
      "standalone-comments-one"
    )
      return route.continue();
    sawOld();
    await held;
    await route
      .fulfill({
        json: {
          errno: 0,
          data: {
            data: [
              {
                objectId: "stale-response",
                nick: "Old article",
                orig: "Must not leak",
                time: 1,
              },
            ],
            count: 1,
            page: 1,
            totalPages: 1,
          },
        },
      })
      .catch(() => {});
  });
  await page.getByLabel("独立文章").selectOption("standalone-comments-one");
  await requested;
  await page.getByLabel("独立文章").selectOption("standalone-comments-two");
  await open();
  releaseOld();
  await plugin.locator("strong", { hasText: "Safe bold" }).waitFor();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(
    await plugin.locator('[data-comment-id="stale-response"]').count(),
    0,
  );
  console.log(
    "PASS delayed responses cannot replace another article's discussion",
  );

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["浅色", "深色"]) {
      await page.getByRole("button", { name: theme, exact: true }).click();
      for (const appearance of ["minimal", "panel"]) {
        await page.getByLabel("外观").selectOption(appearance);
        await plugin.scrollIntoViewIfNeeded();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${width}/${theme}/${appearance}: no horizontal overflow`,
        );
        const box = await plugin.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const theme of ["浅色", "深色"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    await page.getByLabel("强调色").selectOption("#779ddd");
    const textColor = await plugin.evaluate(
      (element) => getComputedStyle(element).color,
    );
    assert.equal(
      await plugin
        .getByRole("link", { name: "Safe link", exact: true })
        .evaluate((element) => getComputedStyle(element).color),
      textColor,
      "pale accents must not wash out comment links",
    );
    await plugin.locator("textarea").focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await plugin
        .getByRole("button", { name: "发表", exact: true })
        .evaluate((element) => getComputedStyle(element).outlineColor),
      textColor,
      "keyboard focus remains readable with a pale accent",
    );
  }
  await page.getByLabel("强调色").selectOption("#b46c42");
  assert.equal(
    await plugin
      .getByRole("button", { name: "发表", exact: true })
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgb(180, 108, 66)",
  );
  await page.getByLabel("语言").selectOption("en");
  await plugin.getByRole("button", { name: "Post", exact: true }).waitFor();
  await plugin.locator("textarea").focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await plugin
      .getByRole("button", { name: "Post", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  console.log(
    "PASS 16 responsive theme/layout combinations, accent, language and keyboard navigation",
  );

  await page.getByRole("button", { name: "卸载插件" }).click();
  assert.equal(await plugin.count(), 0);
  await page.getByRole("button", { name: "挂载插件" }).click();
  await plugin.locator("textarea").waitFor();
  assert.equal(await plugin.locator("textarea").inputValue(), "");
  assert.deepEqual(
    remote,
    [],
    "standalone comments should not fetch remote fonts, avatars or widgets",
  );
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log("PASS remount lifecycle; no remote requests or runtime errors");

  const blocked = await browser.newContext();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    });
  });
  const guest = await blocked.newPage();
  guest.setDefaultTimeout(20000);
  const loginUrl = new URL(supplied ?? preview.url);
  loginUrl.searchParams.set("login", "optional");
  await guest.goto(loginUrl.href);
  const guestPlugin = guest.locator('[data-provider="waline"]');
  await guestPlugin.getByRole("button", { name: "登录", exact: true }).click();
  await guestPlugin
    .getByText("登录需要浏览器会话存储，你仍可直接以访客身份留言。", {
      exact: true,
    })
    .waitFor();
  await guestPlugin
    .getByLabel("称呼", { exact: true })
    .fill("Guest without storage");
  await guestPlugin
    .locator("textarea")
    .fill("Guest comments work without session storage");
  await guestPlugin.getByRole("button", { name: "发表", exact: true }).click();
  await guestPlugin.getByText("已发表", { exact: true }).waitFor();
  await blocked.close();
  console.log("PASS guest posting works with session storage blocked");
} finally {
  await browser.close();
  await preview?.stop();
}
