import type { CommentEntry, CommentService } from "./types.ts";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const count = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;

export class CommentServiceError extends Error {
  readonly kind:
    "network" | "timeout" | "service" | "authentication" | "invalid-response";
  constructor(
    kind:
      "network" | "timeout" | "service" | "authentication" | "invalid-response",
  ) {
    super(kind);
    this.kind = kind;
    this.name = "CommentServiceError";
  }
}

export function safeCommentLink(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    /* Plain author text is still usable without a website. */
  }
}

function normalizeComment(value: unknown, child = false): CommentEntry {
  const entry = record(value);
  if (
    !["string", "number"].includes(typeof entry.objectId) ||
    !String(entry.objectId).length ||
    (typeof entry.objectId === "number" && !Number.isFinite(entry.objectId))
  )
    throw new CommentServiceError("invalid-response");
  // Public comments use their source Markdown. Older services may omit `orig`;
  // their HTML is reduced to text, never inserted as executable markup.
  const body =
    typeof entry.orig === "string"
      ? entry.orig
      : text(entry.comment)
          .replace(/<br\s*\/?\s*>|<\/p>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&");
  return {
    id: String(entry.objectId),
    author: text(entry.nick, "Anonymous"),
    website: safeCommentLink(entry.link),
    body,
    createdAt: count(entry.time) <= 8640000000000000 ? count(entry.time) : 0,
    likes: count(entry.like),
    authorRole: entry.type === "administrator" ? "author" : "reader",
    status: entry.status === "waiting" ? "waiting" : "approved",
    pinned: entry.sticky === true,
    replyTo: text(record(entry.reply_user).nick) || undefined,
    children:
      !child && Array.isArray(entry.children)
        ? entry.children.map((item) => normalizeComment(item, true))
        : [],
  };
}

/** Waline's transport is isolated from rendering and article/template routes. */
export function createWalineService(
  serverURL: string,
  lang: string,
  timeoutMs = 15000,
): CommentService {
  const base = new URL(serverURL.endsWith("/") ? serverURL : `${serverURL}/`);
  if (
    !(
      ["https:"].includes(base.protocol) ||
      (base.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
    ) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("Invalid comments service URL");

  async function request(
    route: string,
    signal: AbortSignal,
    init: RequestInit = {},
    token?: string,
  ) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal.aborted) controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const url = new URL(route, base);
      url.searchParams.set("lang", lang);
      const response = await fetch(url, {
        ...init,
        credentials: "omit",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.status === 401 || response.status === 403)
        throw new CommentServiceError("authentication");
      if (!response.ok) throw new CommentServiceError("service");
      const result = record(await response.json());
      if (typeof result.errno !== "number" || result.errno !== 0)
        throw new CommentServiceError("service");
      return result.data;
    } catch (error) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (timedOut) throw new CommentServiceError("timeout");
      if (error instanceof CommentServiceError) throw error;
      throw new CommentServiceError("network");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  }

  return {
    async list({ articleId, page, pageSize, sort, signal, token }) {
      const sortBy = {
        latest: "insertedAt_desc",
        oldest: "insertedAt_asc",
        hottest: "like_desc",
      }[sort];
      const query = new URLSearchParams({
        path: articleId,
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
      });
      const data = record(
        await request(`api/comment?${query}`, signal, {}, token),
      );
      if (!Array.isArray(data.data))
        throw new CommentServiceError("invalid-response");
      return {
        items: data.data.map((item) => normalizeComment(item)),
        total: count(data.count),
        page: count(data.page, page),
        pages: count(data.totalPages),
      };
    },
    async submit({ articleId, draft, reply, token, signal }) {
      const value = await request(
        "api/comment",
        signal,
        {
          method: "POST",
          body: JSON.stringify({
            nick: draft.name.trim(),
            mail: draft.email.trim(),
            comment: draft.body.trim(),
            url: articleId,
            ua: "",
            ...(reply
              ? { pid: reply.id, rid: reply.rootId, at: reply.author }
              : {}),
          }),
        },
        token,
      );
      return normalizeComment(value);
    },
    async like(id, liked, signal) {
      await request(`api/comment/${encodeURIComponent(id)}`, signal, {
        method: "PUT",
        body: JSON.stringify({ like: liked }),
      });
    },
    async authenticate(token, signal) {
      const user = record(await request("token", signal, {}, token));
      if (!user.objectId || typeof user.display_name !== "string")
        throw new CommentServiceError("authentication");
      return { token, name: user.display_name };
    },
  };
}
