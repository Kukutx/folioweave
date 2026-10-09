"use client";

import dynamic from "next/dynamic";
import { ArrowUpRight, Heart, X } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import type { PluginProps } from "@/core/contracts";
import { optionDefaults, type CommentsOptions } from "./options.generated";
import { commentCopy, type CommentCopy } from "./copy";
import { discussionLanguage } from "./language.mjs";
import { createWalineService, CommentServiceError } from "./waline-service";
import { useCommentSession } from "./use-comment-session";
import type {
  CommentDraft,
  CommentEntry,
  CommentPage,
  CommentSort,
  ReplyTarget,
} from "./types";
import styles from "./waline.module.css";

const CommentBody = dynamic(() => import("./comment-body"), {
  loading: () => null,
});
const emptyDraft: CommentDraft = { name: "", email: "", body: "" };
type ListState = CommentPage & { loading: boolean; failed: boolean };
type ListAction =
  | { type: "start" }
  | { type: "error" }
  | { type: "like"; id: string; delta: number }
  | { type: "loaded"; value: CommentPage; append: boolean };
function listReducer(state: ListState, action: ListAction): ListState {
  if (action.type === "like") {
    const update = (item: CommentEntry): CommentEntry => ({
      ...item,
      likes:
        item.id === action.id
          ? Math.max(0, item.likes + action.delta)
          : item.likes,
      children: item.children.map(update),
    });
    return { ...state, items: state.items.map(update) };
  }
  if (action.type === "start")
    return { ...state, loading: true, failed: false };
  if (action.type === "error")
    return { ...state, loading: false, failed: true };
  const items = action.append
    ? [
        ...state.items,
        ...action.value.items.filter(
          (item) => !state.items.some((previous) => previous.id === item.id),
        ),
      ]
    : action.value.items;
  return { ...action.value, items, loading: false, failed: false };
}
function readableOnAccent(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)
    ?.map((value) => parseInt(value, 16) / 255) ?? [0, 0, 0];
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  const luminance =
    linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

const Entry = memo(function CommentEntryView({
  item,
  rootId,
  copy,
  dateFormatter,
  reply,
  liked,
  likeBusy,
  onLike,
}: {
  item: CommentEntry;
  rootId: string;
  copy: CommentCopy;
  dateFormatter: Intl.DateTimeFormat;
  reply: (target: ReplyTarget) => void;
  liked: ReadonlySet<string>;
  likeBusy: ReadonlySet<string>;
  onLike: (item: CommentEntry) => void;
}) {
  const date = item.createdAt ? new Date(item.createdAt) : null;
  return (
    <li className={styles.entry} data-comment-id={item.id}>
      <div className={styles.avatar} aria-hidden="true">
        {Array.from(item.author.trim())[0]?.toUpperCase() ?? "·"}
      </div>
      <div className={styles.entryMain}>
        <div className={styles.byline}>
          {item.website ? (
            <a
              href={item.website}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className={styles.author}
            >
              {item.author}
              <ArrowUpRight size={12} />
            </a>
          ) : (
            <span className={styles.author}>{item.author}</span>
          )}
          {item.authorRole === "author" && (
            <span className={styles.badge}>{copy.author}</span>
          )}
          {item.pinned && <span className={styles.badge}>{copy.pinned}</span>}
          {date && (
            <time dateTime={date.toISOString()}>
              {dateFormatter.format(date)}
            </time>
          )}
        </div>
        {item.replyTo && (
          <p className={styles.replyContext}>↳ {item.replyTo}</p>
        )}
        <div className={styles.body}>
          <CommentBody body={item.body} />
        </div>
        {item.status === "waiting" ? (
          <p className={styles.pending}>{copy.pending}</p>
        ) : (
          <div className={styles.entryActions}>
            <button
              type="button"
              onClick={() =>
                reply({ id: item.id, rootId, author: item.author })
              }
            >
              {copy.reply}
            </button>
            <button
              type="button"
              aria-label={`${liked.has(item.id) ? copy.unlike : copy.like} · ${item.author}`}
              aria-pressed={liked.has(item.id)}
              disabled={likeBusy.has(item.id)}
              onClick={() => onLike(item)}
            >
              <Heart
                size={14}
                fill={liked.has(item.id) ? "currentColor" : "none"}
              />
              {item.likes || ""}
            </button>
          </div>
        )}
        {item.children.length > 0 && (
          <ol className={styles.replies}>
            {item.children.map((child) => (
              <Entry
                key={child.id}
                item={child}
                rootId={rootId}
                copy={copy}
                dateFormatter={dateFormatter}
                reply={reply}
                liked={liked}
                likeBusy={likeBusy}
                onLike={onLike}
              />
            ))}
          </ol>
        )}
      </div>
    </li>
  );
});

function Discussion({
  options,
  articleId,
  lang,
}: {
  options: CommentsOptions;
  articleId: string;
  lang: string;
}) {
  const copy = commentCopy(lang);
  const loginEnabled = (options.login ?? optionDefaults.login) === "optional";
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(lang, { month: "short", day: "numeric" }),
    [lang],
  );
  const service = useMemo(
    () => createWalineService(options.serverURL!, lang),
    [options.serverURL, lang],
  );
  const [request, setRequest] = useState<{
    sort: CommentSort;
    page: number;
    revision: number;
  }>({ sort: "latest", page: 1, revision: 0 });
  const [list, dispatch] = useReducer(listReducer, {
    items: [],
    total: 0,
    page: 1,
    pages: 0,
    loading: true,
    failed: false,
  });
  const [draft, setDraft] = useState<CommentDraft>(emptyDraft);
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const restoreEditor = useCallback(
    (value: { draft: CommentDraft; reply: ReplyTarget | null }) => {
      setDraft(value.draft);
      setReply(value.reply);
    },
    [],
  );
  const auth = useCommentSession(
    options.serverURL!,
    lang,
    service,
    loginEnabled,
    articleId,
    restoreEditor,
  );
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [likeBusy, setLikeBusy] = useState<Set<string>>(() => new Set());
  const likeRequests = useRef(new Set<string>());
  const requests = useRef(new Set<AbortController>());
  const submitting = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const formId = useId();
  const pageSize = options.pageSize ?? optionDefaults.pageSize;
  const maxLength = options.maxLength ?? optionDefaults.maxLength;
  const nearLimit = draft.body.length >= Math.ceil(maxLength * 0.9);
  const showTotal = list.items.length > 0 || (!list.loading && !list.failed);
  const token = auth.session?.token;
  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "start" });
    void service
      .list({
        articleId,
        page: request.page,
        pageSize,
        sort: request.sort,
        signal: controller.signal,
        token,
      })
      .then((value) => {
        if (!controller.signal.aborted)
          dispatch({ type: "loaded", value, append: request.page > 1 });
      })
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: "error" });
      });
    return () => controller.abort();
  }, [service, articleId, request, pageSize, token]);
  useEffect(() => {
    const active = requests.current;
    return () => {
      for (const controller of active) controller.abort();
      active.clear();
    };
  }, []);
  const refresh = () =>
    setRequest((value) => ({
      ...value,
      page: 1,
      revision: value.revision + 1,
    }));
  const chooseReply = useCallback((target: ReplyTarget) => {
    setReply(target);
    textarea.current?.focus({ preventScroll: true });
    textarea.current?.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const authored = { ...draft, name: auth.session?.name ?? draft.name };
    const problem =
      !authored.name.trim() || !authored.body.trim()
        ? copy.required
        : authored.body.length > maxLength
          ? copy.tooLong
          : authored.email.trim() &&
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authored.email.trim())
            ? copy.invalidEmail
            : null;
    if (problem) {
      setNotice({ text: problem, error: true });
      return;
    }
    submitting.current = true;
    setSending(true);
    setNotice(null);
    const controller = new AbortController();
    requests.current.add(controller);
    try {
      const posted = await service.submit({
        articleId,
        draft: authored,
        reply,
        token,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setDraft((value) => ({ ...value, body: "" }));
      setReply(null);
      setNotice({
        text: posted.status === "waiting" ? copy.review : copy.sent,
        error: false,
      });
      refresh();
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice({
          text:
            error instanceof CommentServiceError && error.kind === "timeout"
              ? copy.unknown
              : copy.failed,
          error: true,
        });
    } finally {
      requests.current.delete(controller);
      submitting.current = false;
      if (!controller.signal.aborted) setSending(false);
    }
  }
  const toggleLike = useCallback(
    async (item: CommentEntry) => {
      if (likeRequests.current.has(item.id)) return;
      likeRequests.current.add(item.id);
      setLikeBusy(new Set(likeRequests.current));
      const controller = new AbortController();
      requests.current.add(controller);
      try {
        await service.like(item.id, !liked.has(item.id), controller.signal);
        if (!controller.signal.aborted)
          dispatch({
            type: "like",
            id: item.id,
            delta: liked.has(item.id) ? -1 : 1,
          });
        if (!controller.signal.aborted)
          setLiked((previous) => {
            const next = new Set(previous);
            if (next.has(item.id)) next.delete(item.id);
            else next.add(item.id);
            return next;
          });
      } catch {
        if (!controller.signal.aborted)
          setNotice({ text: copy.likesFailed, error: true });
      } finally {
        requests.current.delete(controller);
        likeRequests.current.delete(item.id);
        if (!controller.signal.aborted)
          setLikeBusy(new Set(likeRequests.current));
      }
    },
    [service, liked, copy.likesFailed],
  );
  return (
    <>
      <header className={styles.heading}>
        <h2>{options.heading ?? copy.heading}</h2>
        {showTotal && (
          <span
            className={styles.total}
            aria-label={`${list.total} ${copy.comments}`}
          >
            {list.total}
          </span>
        )}
      </header>
      <form
        className={styles.composer}
        onSubmit={submit}
        aria-label={copy.send}
      >
        {loginEnabled && (
          <div className={styles.composerTop}>
            {auth.session && <span>{auth.session.name}</span>}
            <button
              type="button"
              className={styles.textButton}
              disabled={sending}
              onClick={() =>
                auth.session ? auth.logout() : auth.login({ draft, reply })
              }
            >
              {auth.session ? copy.logout : copy.login}
              <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        {!auth.session && (
          <div className={styles.identity}>
            <label htmlFor={`${formId}-name`}>
              {copy.name}
              <input
                id={`${formId}-name`}
                autoComplete="nickname"
                maxLength={60}
                required
                disabled={sending}
                value={draft.name}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, name: event.target.value }))
                }
              />
            </label>
            <label htmlFor={`${formId}-email`}>
              {copy.email}
              <span>{copy.optional}</span>
              <input
                id={`${formId}-email`}
                type="email"
                autoComplete="email"
                maxLength={254}
                disabled={sending}
                value={draft.email}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, email: event.target.value }))
                }
              />
            </label>
          </div>
        )}
        {reply && (
          <div className={styles.replyBanner}>
            <span>
              {copy.replyTo} <strong>{reply.author}</strong>
            </span>
            <button
              type="button"
              aria-label={copy.cancel}
              disabled={sending}
              onClick={() => {
                setReply(null);
                textarea.current?.focus();
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}
        <label className={styles.srOnly} htmlFor={`${formId}-body`}>
          {options.placeholder ?? copy.placeholder}
        </label>
        <textarea
          ref={textarea}
          id={`${formId}-body`}
          required
          maxLength={maxLength}
          disabled={sending}
          placeholder={options.placeholder ?? copy.placeholder}
          value={draft.body}
          onChange={(event) =>
            setDraft((value) => ({ ...value, body: event.target.value }))
          }
          aria-describedby={nearLimit ? `${formId}-limit` : undefined}
        />
        <div className={styles.composerBottom}>
          {nearLimit && (
            <span id={`${formId}-limit`}>
              {draft.body.length} / {maxLength}
            </span>
          )}
          <button type="submit" className={styles.submit} disabled={sending}>
            {sending ? copy.sending : copy.send}
          </button>
        </div>
      </form>
      {auth.error && (
        <p className={styles.feedback} role="status">
          {auth.error === "storage" ? copy.loginUnavailable : copy.loginFailed}
        </p>
      )}
      {notice && (
        <p
          className={styles.feedback}
          data-error={notice.error}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
          {notice.text === copy.unknown && (
            <button type="button" onClick={refresh}>
              {copy.refresh}
            </button>
          )}
        </p>
      )}
      {list.total > 1 && (
        <div className={styles.listHeader}>
          <div role="group" aria-label={copy.sort} className={styles.sort}>
            {(["latest", "oldest", "hottest"] as const).map((sort) => (
              <button
                type="button"
                key={sort}
                aria-pressed={request.sort === sort}
                onClick={() =>
                  setRequest((value) => ({
                    sort,
                    page: 1,
                    revision: value.revision + 1,
                  }))
                }
              >
                {copy[sort]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div aria-busy={list.loading} className={styles.list}>
        <ol className={styles.entries}>
          {list.items.map((item) => (
            <Entry
              key={item.id}
              item={item}
              rootId={item.id}
              copy={copy}
              dateFormatter={dateFormatter}
              reply={chooseReply}
              liked={liked}
              likeBusy={likeBusy}
              onLike={toggleLike}
            />
          ))}
        </ol>
        {list.loading && (
          <p className={styles.listMessage} role="status">
            {copy.loading}
          </p>
        )}
        {list.failed && (
          <div className={styles.listMessage} role="alert">
            <p>{copy.unavailable}</p>
            <button
              type="button"
              className={styles.secondary}
              onClick={() =>
                setRequest((value) => ({
                  ...value,
                  revision: value.revision + 1,
                }))
              }
            >
              {copy.retry}
            </button>
          </div>
        )}
        {!list.loading && !list.failed && !list.items.length && (
          <p className={styles.empty}>{copy.empty}</p>
        )}
        {!list.loading && !list.failed && list.page < list.pages && (
          <button
            type="button"
            className={styles.more}
            onClick={() =>
              setRequest((value) => ({ ...value, page: list.page + 1 }))
            }
          >
            {copy.more}
          </button>
        )}
      </div>
    </>
  );
}

export default function WalineComments({
  options,
  context,
}: PluginProps<CommentsOptions>) {
  const [started, setStarted] = useState(false);
  const host = useRef<HTMLElement>(null);
  const lang = options.lang ?? discussionLanguage(context.locale);
  const copy = commentCopy(lang);
  useEffect(() => {
    if (
      started ||
      options.loading === "manual" ||
      !host.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [started, options.loading]);
  if (!context.article || !options.serverURL) return null;
  const accent =
    options.accent && /^#[0-9a-f]{6}$/i.test(options.accent)
      ? options.accent
      : undefined;
  return (
    <section
      ref={host}
      className={styles.comments}
      data-plugin="comments"
      data-provider="waline"
      data-appearance={options.appearance ?? optionDefaults.appearance}
      data-theme={options.theme ?? "preferred_color_scheme"}
      lang={lang.startsWith("zh") ? "zh-CN" : "en"}
      aria-label={options.heading ?? copy.heading}
      style={
        accent
          ? ({
              "--comments-accent": accent,
              "--comments-on-accent": readableOnAccent(accent),
            } as CSSProperties)
          : undefined
      }
    >
      {started ? (
        <Discussion
          options={options}
          articleId={context.article.id}
          lang={lang}
        />
      ) : (
        <>
          <header className={styles.heading}>
            <h2>{options.heading ?? copy.heading}</h2>
          </header>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setStarted(true)}
          >
            {copy.load}
          </button>
        </>
      )}
    </section>
  );
}
