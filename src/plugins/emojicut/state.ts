import type { AIErrorKind } from "./ai/provider";

/**
 * The page as one state machine:
 *
 *   idle → loading → cutting → naming → done
 *
 * `loading` reads a sheet or has AI design one; `naming` only follows an AI
 * sheet. Any step can end in `error`, which keeps the stickers already cut.
 * Side effects (workers, requests, object URLs) live in the page component;
 * this reducer only records what they report.
 */

export type Mode = "cut" | "ai";

export type Sticker = {
  id: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  name: string;
  naming: boolean;
  /** Its place in the batch it arrived with, for the staggered drop-in. */
  order: number;
};

export type PageError =
  | { kind: "noStickers" | "read" | "process" | "zip" }
  | { kind: "ai"; ai: AIErrorKind; model?: string };

export type Phase =
  | { kind: "idle" }
  | { kind: "loading"; task: "read" | "design" }
  | { kind: "cutting"; stage: "scan" | "cut"; done: number; total: number; fraction: number }
  | { kind: "naming"; done: number; total: number }
  | { kind: "done" }
  | { kind: "error"; error: PageError };

export type State = {
  mode: Mode;
  phase: Phase;
  stickers: Sticker[];
  /** Object URL of the sheet being cut, for adding stickers by hand. */
  sheetUrl: string | null;
  /** Whether stickers get AI names (the sheet came from AI). */
  named: boolean;
};

export type Action =
  | { type: "mode"; mode: Mode }
  | { type: "start"; task: "read" | "design" }
  | { type: "sheet"; url: string; named: boolean }
  | { type: "progress"; stage: "scan" | "cut"; done: number; total: number; fraction: number }
  | { type: "cut"; stickers: Sticker[] }
  | { type: "named"; id: string; name: string | null }
  | { type: "add"; sticker: Sticker }
  | { type: "rename"; id: string; name: string }
  | { type: "fail"; error: PageError }
  | { type: "reset" };

export const initialState = (mode: Mode): State => ({
  mode,
  phase: { kind: "idle" },
  stickers: [],
  sheetUrl: null,
  named: false,
});

export const isBusy = (phase: Phase) =>
  phase.kind === "loading" || phase.kind === "cutting" || phase.kind === "naming";

function namingPhase(stickers: Sticker[]): Phase {
  const total = stickers.filter((s) => s.naming).length;
  return total ? { kind: "naming", done: 0, total } : { kind: "done" };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "mode":
      if (isBusy(state.phase)) return state;
      // An error belongs to the mode it happened in.
      return {
        ...state,
        mode: action.mode,
        phase:
          state.phase.kind !== "error"
            ? state.phase
            : state.stickers.length
              ? { kind: "done" }
              : { kind: "idle" },
      };
    case "start":
      return {
        ...state,
        phase: { kind: "loading", task: action.task },
        stickers: [],
        sheetUrl: null,
      };
    case "sheet":
      return {
        ...state,
        phase: { kind: "loading", task: "read" },
        stickers: [],
        sheetUrl: action.url,
        named: action.named,
      };
    case "progress":
      return {
        ...state,
        phase: {
          kind: "cutting",
          stage: action.stage,
          done: action.done,
          total: action.total,
          fraction: action.fraction,
        },
      };
    case "cut":
      return { ...state, stickers: action.stickers, phase: namingPhase(action.stickers) };
    case "named": {
      const stickers = state.stickers.map((s) =>
        // A name the visitor typed meanwhile wins.
        s.id === action.id && s.naming
          ? { ...s, name: action.name ?? s.name, naming: false }
          : s,
      );
      if (state.phase.kind !== "naming") return { ...state, stickers };
      const done = state.phase.done + 1;
      return {
        ...state,
        stickers,
        phase:
          done >= state.phase.total
            ? { kind: "done" }
            : { kind: "naming", done, total: state.phase.total },
      };
    }
    case "add":
      return {
        ...state,
        stickers: [...state.stickers, action.sticker],
        phase:
          state.phase.kind === "naming"
            ? { ...state.phase, total: state.phase.total + (action.sticker.naming ? 1 : 0) }
            : action.sticker.naming
              ? { kind: "naming", done: 0, total: 1 }
              : { kind: "done" },
      };
    case "rename":
      return {
        ...state,
        stickers: state.stickers.map((s) =>
          s.id === action.id ? { ...s, name: action.name, naming: false } : s,
        ),
      };
    case "fail":
      return { ...state, phase: { kind: "error", error: action.error } };
    case "reset":
      return initialState(state.mode);
  }
}
