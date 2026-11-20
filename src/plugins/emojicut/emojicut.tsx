"use client";

import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useApiKey } from "./ai/key-store";
import { AIError, type StickerAI } from "./ai/provider";
import type { Copy } from "./copy";
import { createCutSession, CutError, type CutResult, type CutSession } from "./cut/cutter";
import type { Rect } from "./cut/segment";
import { fontStack } from "./fonts";
import { saveBlob, uniqueFileNames } from "./lib/files";
import { ObjectUrls } from "./lib/object-urls";
import { createZip } from "./lib/zip";
import {
  initialState,
  isBusy,
  reducer,
  type Mode,
  type PageError,
  type Sticker,
} from "./state";
import { AiPanel } from "./ui/ai-panel";
import { CropDialog } from "./ui/crop-dialog";
import { DialogHostContext } from "./ui/dialog-host";
import { DropScreen } from "./ui/drop-screen";
import { HelpDialog } from "./ui/help-dialog";
import { Printer } from "./ui/printer";
import { ProgressScreen } from "./ui/progress-screen";
import { Tray } from "./ui/tray";
import controls from "./ui/controls.module.css";
import printer from "./ui/printer.module.css";
import styles from "./ui/page.module.css";

/** Stickers named at once while an AI sheet is named. */
const NAMING_AT_ONCE = 3;

/** What runs now: newer runs and Start over make older results stale. */
type Run = { id: number; session: CutSession | null; abort: AbortController | null };

function errorText(copy: Copy, error: PageError): string {
  if (error.kind !== "ai") return copy.errors[error.kind];
  if (error.ai === "model") return copy.errors.model(error.model ?? "");
  return copy.errors[error.ai];
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

/** The EmojiCut page. `ai` is null when the site turned AI design off. */
export function EmojiCut({ copy, ai }: { copy: Copy; ai: StickerAI | null }) {
  const [state, dispatch] = useReducer(reducer, "cut" as Mode, initialState);
  const { mode, phase, stickers } = state;
  const [apiKey, setApiKey] = useApiKey(ai?.keyStorage ?? null);
  const [reference, setReference] = useState<{ blob: Blob; url: string } | null>(null);
  const [style, setStyle] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  // Sheets and stickers; the reference image is owned separately so a new
  // run never revokes it.
  const [results] = useState(() => new ObjectUrls());
  const [inputs] = useState(() => new ObjectUrls());
  const run = useRef<Run>({ id: 0, session: null, abort: null });

  const busy = isBusy(phase);

  /** Stops the current run and returns the id of the next one. */
  const begin = () => {
    const current = run.current;
    current.session?.dispose();
    current.abort?.abort();
    run.current = { id: current.id + 1, session: null, abort: null };
    results.revokeAll();
    return run.current.id;
  };
  const stale = (id: number) => run.current.id !== id;

  useEffect(
    () => () => {
      run.current.session?.dispose();
      run.current.abort?.abort();
      results.revokeAll();
      inputs.revokeAll();
    },
    [results, inputs],
  );

  const toSticker = (cut: CutResult, name: string, order: number, named: boolean): Sticker => ({
    id: newId(),
    blob: cut.blob,
    url: results.create(cut.blob),
    width: cut.width,
    height: cut.height,
    name,
    naming: named,
    order,
  });

  const nameStickers = async (list: Sticker[], id: number) => {
    if (!ai) return;
    const key = apiKey;
    const abort = run.current.abort ?? new AbortController();
    run.current.abort = abort;
    const queue = [...list];
    const next = async () => {
      for (let sticker = queue.shift(); sticker; sticker = queue.shift()) {
        let name: string | null = null;
        try {
          name = await ai.nameSticker({ image: sticker.blob, apiKey: key, signal: abort.signal });
        } catch {
          if (abort.signal.aborted) return;
        }
        if (stale(id)) return;
        dispatch({ type: "named", id: sticker.id, name });
      }
    };
    await Promise.all(Array.from({ length: NAMING_AT_ONCE }, next));
  };

  /** Cuts a sheet; an AI sheet's stickers are then named. */
  const cut = async (sheet: Blob, named: boolean, id: number) => {
    dispatch({ type: "sheet", url: results.create(sheet), named });
    const session = createCutSession();
    run.current.session = session;
    let cuts: CutResult[];
    try {
      cuts = await session.cut(sheet, (progress) => {
        if (!stale(id)) dispatch({ type: "progress", ...progress });
      });
    } catch (error) {
      if (stale(id) || (error instanceof CutError && error.code === "cancelled")) return;
      const unreadable = error instanceof CutError && error.code === "decode";
      // An unreadable file is the visitor's to fix; anything else is a bug.
      if (unreadable) console.warn("EmojiCut: not an image", error);
      else console.error("EmojiCut: cutting failed", error);
      dispatch({ type: "fail", error: { kind: unreadable ? "read" : "process" } });
      return;
    }
    if (stale(id)) return;
    if (!cuts.length) {
      dispatch({ type: "fail", error: { kind: "noStickers" } });
      return;
    }
    const withNames = named && Boolean(ai && apiKey);
    const list = cuts.map((c, i) => toSticker(c, `sticker_${i + 1}`, i, withNames));
    dispatch({ type: "cut", stickers: list });
    if (withNames) await nameStickers(list, id);
  };

  const cutFile = (file: Blob) => {
    const id = begin();
    void cut(file, false, id);
  };

  const generate = async () => {
    if (!ai || !reference || !apiKey) return;
    const id = begin();
    const abort = new AbortController();
    run.current.abort = abort;
    dispatch({ type: "start", task: "design" });
    let sheet: Blob;
    try {
      sheet = await ai.designSheet({
        reference: reference.blob,
        prompt: copy.sheetPrompt(style || undefined),
        apiKey,
        signal: abort.signal,
      });
    } catch (error) {
      if (stale(id) || abort.signal.aborted) return;
      console.warn("EmojiCut: design failed", error);
      dispatch({
        type: "fail",
        error:
          error instanceof AIError
            ? { kind: "ai", ai: error.kind, model: error.model }
            : { kind: "ai", ai: "generic" },
      });
      return;
    }
    if (stale(id)) return;
    run.current.abort = null;
    await cut(sheet, true, id);
  };

  const setReferenceFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      dispatch({ type: "fail", error: { kind: "read" } });
      return;
    }
    inputs.revoke(reference?.url);
    setReference({ blob: file, url: inputs.create(file) });
    if (phase.kind === "error") dispatch({ type: "reset" });
  };

  const clearReference = () => {
    inputs.revoke(reference?.url);
    setReference(null);
  };

  /** A file from the chooser, a drop or a paste, for whatever the mode takes. */
  const takeFile = (file: File) => {
    if (busy) return;
    if (mode === "cut") cutFile(file);
    else if (ai && apiKey) setReferenceFile(file);
  };

  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    if (helpOpen || cropOpen) return;
    const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
      entry.type.startsWith("image/"),
    );
    const file = item?.getAsFile();
    if (!file) return;
    event.preventDefault();
    takeFile(file);
  });
  useEffect(() => {
    const listener = (event: ClipboardEvent) => onPaste(event);
    window.addEventListener("paste", listener);
    return () => window.removeEventListener("paste", listener);
  }, []);

  const startOver = () => {
    begin();
    setCropOpen(false);
    dispatch({ type: "reset" });
  };

  const addCrop = async (rect: Rect) => {
    const { session, id } = run.current;
    setCropOpen(false);
    if (!session) return;
    let result: CutResult | null;
    try {
      result = await session.crop(rect);
    } catch {
      return;
    }
    if (!result || stale(id)) return;
    const named = state.named && Boolean(ai && apiKey);
    const sticker = toSticker(result, `sticker_${stickers.length + 1}`, 0, named);
    dispatch({ type: "add", sticker });
    if (named) await nameStickers([sticker], id);
  };

  const downloadAll = async () => {
    setZipping(true);
    try {
      const names = uniqueFileNames(
        stickers.map((sticker) => sticker.name),
        ".png",
      );
      const entries = await Promise.all(
        stickers.map(async (sticker, index) => ({
          name: names[index],
          data: new Uint8Array(await sticker.blob.arrayBuffer()),
        })),
      );
      saveBlob(createZip(entries), "stickers.zip");
    } catch (error) {
      console.error("EmojiCut: ZIP failed", error);
      dispatch({ type: "fail", error: { kind: "zip" } });
    } finally {
      setZipping(false);
    }
  };

  const alert =
    phase.kind === "error" ? (
      <p className={controls.error} role="alert">
        {errorText(copy, phase.error)}
      </p>
    ) : null;
  const sheetUrl = state.sheetUrl;

  return (
    <DialogHostContext value={host}>
      <div
        ref={setHost}
        className={styles.root}
        style={{ "--ec-font": fontStack } as CSSProperties}
      >
        <div className={styles.column}>
          <h1 className={styles.srOnly}>{copy.title}</h1>
          <Printer
            copy={copy}
            aiEnabled={ai !== null}
            mode={mode}
            onMode={(next) => dispatch({ type: "mode", mode: next })}
            busy={busy}
            onDropFile={takeFile}
          >
            {(over) => (
              <>
                {busy ? (
                  <>
                    <ProgressScreen copy={copy} mode={mode} phase={phase} />
                    <div className={printer.controls}>
                      <button type="button" className={controls.secondary} onClick={startOver}>
                        {copy.cancel}
                      </button>
                    </div>
                  </>
                ) : mode === "ai" && ai ? (
                  <AiPanel
                    copy={copy}
                    ai={ai}
                    apiKey={apiKey}
                    onKey={setApiKey}
                    reference={reference?.url ?? null}
                    onReference={setReferenceFile}
                    onClearReference={clearReference}
                    style={style}
                    onStyle={setStyle}
                    onGenerate={() => void generate()}
                    over={over}
                    alert={alert}
                  />
                ) : (
                  <DropScreen
                    mode="cut"
                    label={copy.dropSheetLabel}
                    title={copy.dropSheet}
                    hint={copy.dropSheetHint}
                    over={over}
                    onFile={cutFile}
                    button={copy.chooseImage}
                  />
                )}
                {!(mode === "ai" && ai && apiKey && !busy) && alert}
                <noscript>
                  <p className={controls.error}>{copy.noscript}</p>
                </noscript>
              </>
            )}
          </Printer>

          <button
            type="button"
            className={`${controls.text} ${styles.help}`}
            onClick={() => setHelpOpen(true)}
            aria-haspopup="dialog"
          >
            {copy.help}
          </button>

          {stickers.length > 0 && (
            <Tray
              copy={copy}
              stickers={stickers}
              zipping={zipping}
              canAdd={Boolean(sheetUrl) && !busy}
              onDownloadAll={() => void downloadAll()}
              onAdd={() => setCropOpen(true)}
              onStartOver={startOver}
              onRename={(id, name) => dispatch({ type: "rename", id, name })}
            />
          )}
        </div>

        {helpOpen && <HelpDialog copy={copy} ai={ai} onClose={() => setHelpOpen(false)} />}
        {cropOpen && sheetUrl && (
          <CropDialog
            copy={copy}
            imageUrl={sheetUrl}
            onClose={() => setCropOpen(false)}
            onConfirm={(rect) => void addCrop(rect)}
          />
        )}
      </div>
    </DialogHostContext>
  );
}
