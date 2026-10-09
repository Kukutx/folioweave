"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CommentDraft,
  CommentService,
  CommentSession,
  ReplyTarget,
} from "./types";

type EditorState = { draft: CommentDraft; reply: ReplyTarget | null };
function validEditor(value: unknown): value is EditorState {
  if (!value || typeof value !== "object") return false;
  const { draft, reply } = value as EditorState;
  return (
    !!draft &&
    typeof draft.body === "string" &&
    typeof draft.name === "string" &&
    typeof draft.email === "string" &&
    (reply === null ||
      (!!reply &&
        typeof reply.id === "string" &&
        typeof reply.rootId === "string" &&
        typeof reply.author === "string"))
  );
}

const keyFor = (serverURL: string) => `fw:comments:session:${serverURL}`;

/** Same-tab login works with strict COOP headers and mobile popup blockers. */
export function useCommentSession(
  serverURL: string,
  lang: string,
  service: CommentService,
  enabled: boolean,
  articleId: string,
  restoreEditor: (editor: EditorState) => void,
) {
  const [session, setSession] = useState<CommentSession | null>(null);
  const [error, setError] = useState<"storage" | "login" | null>(null);
  const pending = useRef<AbortController | null>(null);
  const resumed = useRef<{ token?: string; editor?: EditorState } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    pending.current = controller;
    const key = keyFor(serverURL);
    let token: string | undefined;
    let editor: EditorState | undefined;
    if (!resumed.current)
      try {
        const stored = JSON.parse(sessionStorage.getItem(key) ?? "null");
        const redirect = JSON.parse(
          sessionStorage.getItem(`${key}:redirect`) ?? "null",
        );
        const current = new URL(location.href);
        const returnedToken = current.searchParams.get("token");
        current.searchParams.delete("token");
        if (
          redirect?.returnTo === current.href &&
          redirect.articleId === articleId &&
          redirect.expiresAt > Date.now()
        ) {
          sessionStorage.removeItem(`${key}:redirect`);
          editor = validEditor(redirect.editor) ? redirect.editor : undefined;
          if (returnedToken) {
            token = returnedToken;
            history.replaceState(history.state, "", current.href);
          }
        } else if (
          stored?.expiresAt > Date.now() &&
          typeof stored.token === "string"
        )
          token = stored.token;
      } catch {
        /* Storage can be unavailable; guest comments remain functional. */
      }
    if (!resumed.current) resumed.current = { token, editor };
    ({ token, editor } = resumed.current);
    void (async () => {
      try {
        const verified = token
          ? await service.authenticate(token, controller.signal)
          : null;
        if (controller.signal.aborted) return;
        if (editor) restoreEditor(editor);
        resumed.current = { token };
        if (verified) {
          setSession(verified);
          setError(null);
          try {
            sessionStorage.setItem(
              key,
              JSON.stringify({ ...verified, expiresAt: Date.now() + 3600000 }),
            );
          } catch {
            /* Keep the current in-memory session. */
          }
        }
      } catch {
        if (controller.signal.aborted) return;
        if (editor) restoreEditor(editor);
        resumed.current = {};
        setSession(null);
        setError("login");
        try {
          sessionStorage.removeItem(key);
        } catch {
          /* Best effort. */
        }
      }
    })();
    return () => controller.abort();
  }, [serverURL, lang, service, enabled, articleId, restoreEditor]);

  function login(editor: EditorState) {
    if (!enabled) return;
    try {
      const returnTo = new URL(location.href);
      returnTo.searchParams.delete("token");
      sessionStorage.setItem(
        `${keyFor(serverURL)}:redirect`,
        JSON.stringify({
          returnTo: returnTo.href,
          articleId,
          editor,
          expiresAt: Date.now() + 600000,
        }),
      );
      const url = new URL(
        "ui/login",
        serverURL.endsWith("/") ? serverURL : `${serverURL}/`,
      );
      url.searchParams.set("lng", lang);
      url.searchParams.set("redirect", returnTo.href);
      location.assign(url.href);
    } catch {
      setError("storage");
    }
  }
  function logout() {
    pending.current?.abort();
    resumed.current = {};
    setSession(null);
    try {
      sessionStorage.removeItem(keyFor(serverURL));
    } catch {
      /* Guest mode requires no storage. */
    }
  }
  return { session: enabled ? session : null, error, login, logout };
}
