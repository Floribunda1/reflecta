import { Atom } from "effect/unstable/reactivity";
import { runAtom } from "@renderer/lib/atoms";
import type { CanvasDocument, CanvasViewport } from "@reflecta/ui/canvas";
import {
  initialCanvasSession,
  reduceCanvasSession,
  type CanvasAction,
  type CanvasEffect,
  type CanvasRightPanel,
  type CanvasSessionState,
  type CanvasSnapshot,
} from "./session";
import type { SaveStatus } from "./workspace/debounced-latest-saver";

/**
 * 画布会话的原子投影。
 *
 * SSOT 是 keepAlive 的 `sessionAtom`，只经 `dispatchCanvasAction` 写入。
 * 对外 atoms 是切片投影（Object.is 相等则不通知）：拖拽更新文档时，空态 / 库按钮 / 面板
 * 不会重渲染；工作区宿主不订阅文档。
 */

const sessionAtom: Atom.Writable<CanvasSessionState, CanvasSessionState> = Atom.keepAlive(
  Atom.make(initialCanvasSession),
);

export const selectedCanvasIdAtom: Atom.Atom<string | null> = Atom.map(
  sessionAtom,
  (session) => session.canvasId,
);
export const canvasHydratedAtom: Atom.Atom<boolean> = Atom.map(
  sessionAtom,
  (session) => session.hydrated,
);
export const canvasSnapshotAtom: Atom.Atom<CanvasSnapshot | null> = Atom.map(
  sessionAtom,
  (session) => session.snapshot,
);
export const documentAtom: Atom.Atom<CanvasDocument> = Atom.map(
  sessionAtom,
  (session) => session.document,
);
export const viewportAtom: Atom.Atom<CanvasViewport | null> = Atom.map(
  sessionAtom,
  (session) => session.viewport,
);
export const selectionAtom: Atom.Atom<string[]> = Atom.map(
  sessionAtom,
  (session) => session.selection,
);
export const canvasPanelAtom: Atom.Atom<CanvasRightPanel> = Atom.map(
  sessionAtom,
  (session) => session.panel,
);
export const canvasSearchOpenAtom: Atom.Atom<boolean> = Atom.map(
  sessionAtom,
  (session) => session.searchOpen,
);
export const canvasSaveStatusAtom: Atom.Atom<SaveStatus> = Atom.map(
  sessionAtom,
  (session) => session.saveStatus,
);

/** 空态只暴露布尔：document 每次拖拽都会变，订阅方不应跟着重渲染。 */
export const canvasIsEmptyAtom: Atom.Atom<boolean> = Atom.map(
  sessionAtom,
  (session) => session.hydrated && session.document.elements.length === 0,
);
export const canvasLibraryOpenAtom: Atom.Atom<boolean> = Atom.map(
  sessionAtom,
  (session) => session.panel?.mode === "library",
);

export type CanvasEffectsRuntime = {
  saveDocument: (document: CanvasDocument) => void;
  saveViewport: (viewport: CanvasViewport) => void;
  retrySave: () => void;
  flushSaves: () => void;
  focusCell: (id: string) => void;
};

let effectsRuntime: CanvasEffectsRuntime | null = null;

export function provideCanvasEffects(runtime: CanvasEffectsRuntime | null): void {
  effectsRuntime = runtime;
}

function interpret(effects: readonly CanvasEffect[]): void {
  const runtime = effectsRuntime;
  if (!runtime || effects.length === 0) return;
  for (const effect of effects) {
    switch (effect.type) {
      case "saveDocument":
        runtime.saveDocument(effect.document);
        break;
      case "saveViewport":
        runtime.saveViewport(effect.viewport);
        break;
      case "retrySave":
        runtime.retrySave();
        break;
      case "flushSaves":
        runtime.flushSaves();
        break;
      case "focusCell":
        runtime.focusCell(effect.id);
        break;
    }
  }
}

export function getCanvasSessionState(): CanvasSessionState {
  return runAtom(Atom.get(sessionAtom));
}

export function dispatchCanvasAction(action: CanvasAction): void {
  const previous = getCanvasSessionState();
  const { state, effects } = reduceCanvasSession(previous, action);
  if (state !== previous) {
    runAtom(Atom.set(sessionAtom, state));
  }
  interpret(effects);
}

export const canvasStoreActions = {
  selectCanvas: (canvasId: string | null) => {
    if (canvasId) dispatchCanvasAction({ type: "session/opened", canvasId });
    else dispatchCanvasAction({ type: "session/closed" });
  },
};

export const readCanvasState = getCanvasSessionState;

export { initialCanvasSession as initialCanvasState };
export type { CanvasAction, CanvasRightPanel, CanvasSessionState, CanvasSnapshot };
