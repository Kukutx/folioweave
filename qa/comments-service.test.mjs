import assert from "node:assert/strict";
import test from "node:test";
import {
  createWalineService,
  safeCommentLink,
} from "../src/plugins/comments/waline-service.ts";
import {
  loadCatalog,
  validateExtensionOptions,
  extensionSources,
} from "../src/core/extensions.mjs";
import demo from "../governance/demo-portfolio.json" with { type: "json" };

const source = {
  objectId: 1,
  nick: "Reader",
  orig: "**Hello**",
  time: 1,
  like: 2,
  children: [],
};
const signal = () => new AbortController().signal;
const response = (data) => Response.json({ errno: 0, data });

test("Waline adapter keeps permanent article IDs, pagination and sorting explicit", async (t) => {
  let seen;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    seen = { url, options };
    return response({ data: [source], count: 1, page: 2, totalPages: 3 });
  });
  const result = await createWalineService(
    "https://comments.example/sub",
    "zh-CN",
  ).list({
    articleId: "stable/article ? &",
    page: 2,
    pageSize: 6,
    sort: "hottest",
    signal: signal(),
    token: "session",
  });
  assert.equal(seen.url.pathname, "/sub/api/comment");
  assert.equal(seen.url.searchParams.get("path"), "stable/article ? &");
  assert.equal(seen.url.searchParams.get("sortBy"), "like_desc");
  assert.equal(seen.options.credentials, "omit");
  assert.equal(seen.options.headers.Authorization, "Bearer session");
  assert.equal(result.items[0].body, "**Hello**");
  assert.equal(result.pages, 3);
});

test("guest submissions and replies preserve server moderation and send no token", async (t) => {
  let sent;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    sent = options;
    return response({ ...source, status: "waiting" });
  });
  const result = await createWalineService(
    "https://comments.example",
    "en",
  ).submit({
    articleId: "stable-id",
    draft: { name: " Reader ", email: "", body: " A reply " },
    reply: { id: "3", rootId: "1", author: "Author" },
    signal: signal(),
  });
  assert.equal(sent.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(sent.body), {
    nick: "Reader",
    mail: "",
    comment: "A reply",
    url: "stable-id",
    ua: "",
    pid: "3",
    rid: "1",
    at: "Author",
  });
  assert.equal(result.status, "waiting");
});

test("failed writes are never retried automatically", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({ errno: 500 }, { status: 503 });
  });
  await assert.rejects(
    createWalineService("https://comments.example", "en").submit({
      articleId: "id",
      draft: { name: "A", email: "", body: "body" },
      reply: null,
      signal: signal(),
    }),
    { kind: "service" },
  );
  assert.equal(requests, 1);
});

test("unmount abort and timeout are distinct and release their requests", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  const service = createWalineService("https://comments.example", "en", 10);
  await assert.rejects(service.like("1", true, signal()), { kind: "timeout" });
  const controller = new AbortController();
  const pending = service.like("1", true, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("unsafe links and malformed provider payloads cannot become executable markup", async (t) => {
  assert.equal(safeCommentLink("javascript:alert(1)"), undefined);
  assert.equal(safeCommentLink("https://name:secret@example.com"), undefined);
  assert.equal(
    safeCommentLink("https://example.com/path"),
    "https://example.com/path",
  );
  t.mock.method(globalThis, "fetch", async () =>
    response({
      data: [
        {
          ...source,
          orig: undefined,
          comment: '<p>Hello</p><img src=x onerror="alert(1)">',
          link: "javascript:alert(1)",
        },
      ],
      count: 1,
    }),
  );
  const page = await createWalineService("https://comments.example", "en").list(
    { articleId: "id", page: 1, pageSize: 6, sort: "latest", signal: signal() },
  );
  assert.equal(page.items[0].body.trim(), "Hello");
  assert.equal(page.items[0].website, undefined);
});

test("guest settings validate without Giscus values and only grant an exact service origin", () => {
  const manifest = loadCatalog().plugins.find((item) => item.id === "comments");
  const options = {
    provider: "waline",
    serverURL: "https://comments.example/sub",
  };
  validateExtensionOptions(manifest, options);
  for (const bad of [
    { provider: "waline" },
    { ...options, serverURL: "http://comments.example" },
    { ...options, serverURL: "https://user:password@comments.example" },
    { ...options, serverURL: "https://comments.example?key=secret" },
    { ...options, pageSize: 100 },
    { ...options, login: "force" },
    { provider: "giscus" },
  ])
    assert.throws(() => validateExtensionOptions(manifest, bad));
  const sources = extensionSources({
    ...demo,
    plugins: { comments: { enabled: true, options } },
  });
  assert.deepEqual(sources["connect-src"], ["https://comments.example"]);
  assert.equal(
    extensionSources({
      ...demo,
      plugins: { comments: { enabled: false, options } },
    })["connect-src"],
    undefined,
  );
});
