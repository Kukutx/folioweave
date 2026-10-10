// Local-only service for the standalone preview and browser contract tests.
// No real account, network provider or persisted author data is used.
type WireComment = {
  objectId: number;
  nick: string;
  orig: string;
  comment: string;
  time: number;
  like: number;
  type?: string;
  status: string;
  sticky: boolean;
  children: WireComment[];
  reply_user?: { nick: string };
};
const state = globalThis as typeof globalThis & {
  commentsFixture?: {
    threads: Map<string, WireComment[]>;
    failures: Set<string>;
    nextId: number;
  };
};
const fixture = (state.commentsFixture ??= {
  threads: new Map<string, WireComment[]>(),
  failures: new Set<string>(),
  nextId: 100,
});
function comment(
  id: number,
  nick: string,
  body: string,
  age: number,
  likes = 0,
): WireComment {
  return {
    objectId: id,
    nick,
    orig: body,
    comment: body,
    time: Date.now() - age * 86400000,
    like: likes,
    status: "approved",
    sticky: false,
    children: [],
  };
}
function seed() {
  const first = comment(
    1,
    "林间",
    "喜欢这种留白。读完之后，刚好有一个安静的位置可以聊两句。",
    2,
    8,
  );
  const reply = comment(
    2,
    "You",
    "谢谢。希望这里的每一次交流，都像文章的自然延续。",
    1,
    3,
  );
  reply.type = "administrator";
  reply.reply_user = { nick: "林间" };
  first.children.push(reply);
  return [
    first,
    comment(
      3,
      "Alex",
      "Small details make a difference. The reading experience feels considered, especially on mobile.",
      3,
      5,
    ),
    comment(4, "小满", "切换模板以后，之前的评论也应该保留下来吧？", 4, 2),
    comment(
      5,
      "Mika",
      "**Less, but better.**\n\n期待看到更多这样的作品。",
      5,
      4,
    ),
    comment(6, "舟", "很舒服的阅读体验，收藏了。", 6, 1),
  ];
}
const json = (data: unknown, status = 200) =>
  Response.json(
    {
      errno: status === 200 ? 0 : status,
      errmsg: status === 200 ? "" : "Fixture failure",
      data,
    },
    { status },
  );
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/ui/login")) {
    // Next may internally normalize 127.0.0.1 to localhost. Check the actual
    // local host requested by the browser, not the normalized Request URL.
    const origin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
    const target = new URL(url.searchParams.get("redirect") ?? "/", origin);
    if (target.origin !== new URL(origin).origin)
      return new Response("Invalid redirect", { status: 400 });
    target.searchParams.set("token", "fixture-only-token");
    return new Response(
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>演示登录</title><body style="font:16px/1.8 system-ui;max-width:440px;margin:12vh auto;padding:24px"><h1>演示登录</h1><p>仅用于测试插件的登录返回和草稿恢复，不连接真实账号。</p><a href="${target.href.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">以演示用户继续</a></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
  if (url.pathname.endsWith("/token"))
    return request.headers.get("authorization") === "Bearer fixture-only-token"
      ? json({ objectId: 1, display_name: "演示用户" })
      : json(null, 401);
  const scenario = url.pathname.split("/")[2];
  const article = url.searchParams.get("path") ?? "standalone-comments-one";
  const key = `${scenario}:${article}`;
  if (scenario === "error" && !fixture.failures.has(key)) {
    fixture.failures.add(key);
    return json(null, 503);
  }
  const items =
    fixture.threads.get(key) ??
    (scenario === "empty" || article.endsWith("two") ? [] : seed());
  fixture.threads.set(key, items);
  const sorted = [...items].sort((a, b) =>
    url.searchParams.get("sortBy") === "like_desc"
      ? b.like - a.like
      : url.searchParams.get("sortBy") === "insertedAt_asc"
        ? a.time - b.time
        : b.time - a.time,
  );
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") || 3));
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  return json({
    data: sorted.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
    count: items.reduce((sum, item) => sum + 1 + item.children.length, 0),
  });
}
export async function POST(request: Request) {
  const url = new URL(request.url);
  const scenario = url.pathname.split("/")[2];
  if (scenario === "submit-error") return json(null, 503);
  const value = await request.json();
  const key = `${scenario}:${value.url}`;
  const items = fixture.threads.get(key) ?? [];
  const item = comment(
    fixture.nextId++,
    value.nick || "演示用户",
    value.comment,
    0,
  );
  if (scenario === "moderated") item.status = "waiting";
  else if (value.rid) {
    const root = items.find(
      (item) => String(item.objectId) === String(value.rid),
    );
    item.reply_user = { nick: value.at };
    root?.children.push(item);
  } else items.unshift(item);
  fixture.threads.set(key, items);
  return json(item);
}
export async function PUT(request: Request) {
  const id = Number(new URL(request.url).pathname.split("/").at(-1));
  const value = await request.json();
  for (const items of fixture.threads.values())
    for (const root of items)
      for (const item of [root, ...root.children])
        if (item.objectId === id)
          item.like = Math.max(0, item.like + (value.like ? 1 : -1));
  return json({});
}
