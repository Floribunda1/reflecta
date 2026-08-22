import type { CanvasDocument, CanvasViewport } from "@reflecta/ui/canvas";
import type { SaveStatus } from "./workspace/debounced-latest-saver";

/**
 * 画布会话状态机。
 *
 * event → action → reduce(state) → { state, effects }
 * 原子投影与副作用解释器在 `store.ts`：本文件是纯函数，也是测试面。
 *
 * 文档有两层、分工不同，避免拖拽时把 X6 当受控 React 树回灌：
 * - snapshot：本次打开的水合快照，只在 hydrate 写一次，供 CanvasGraph 挂载；
 * - document：会话文档 SSOT，供搜索 / 保存 / 空态 / 面板路由命令式读取。
 * X6 是交互引擎的实时几何；每次变更发 `document/changed` 同步进 document。
 */

export type CanvasRightPanel =
  | { mode: "library" }
  | { mode: "detail"; understandingId: string }
  | null;

export type CanvasSnapshot = {
  document: CanvasDocument;
  viewport: CanvasViewport | null;
};

export type CanvasSessionState = {
  canvasId: string | null;
  hydrated: boolean;
  snapshot: CanvasSnapshot | null;
  document: CanvasDocument;
  viewport: CanvasViewport | null;
  selection: string[];
  panel: CanvasRightPanel;
  searchOpen: boolean;
  saveStatus: SaveStatus;
};

export type CanvasAction =
  | { type: "session/opened"; canvasId: string }
  | { type: "session/closed" }
  | { type: "document/hydrated"; document: CanvasDocument; viewport: CanvasViewport | null }
  | { type: "document/changed"; document: CanvasDocument }
  | { type: "viewport/changed"; viewport: CanvasViewport }
  | { type: "selection/changed"; cellIds: string[] }
  | { type: "panel/toggleLibrary" }
  | { type: "panel/openDetail"; understandingId: string }
  | { type: "panel/close" }
  | { type: "search/toggled" }
  | { type: "search/closed" }
  | { type: "search/selected"; id: string }
  | { type: "save/status"; status: SaveStatus }
  | { type: "save/retry" };

export type CanvasEffect =
  | { type: "saveDocument"; document: CanvasDocument }
  | { type: "saveViewport"; viewport: CanvasViewport }
  | { type: "retrySave" }
  | { type: "flushSaves" }
  | { type: "focusCell"; id: string };

export type CanvasReduceResult = {
  state: CanvasSessionState;
  effects: CanvasEffect[];
};

export const EMPTY_CANVAS_DOCUMENT: CanvasDocument = { elements: [], edges: [] };

export const initialCanvasSession: CanvasSessionState = {
  canvasId: null,
  hydrated: false,
  snapshot: null,
  document: EMPTY_CANVAS_DOCUMENT,
  viewport: null,
  selection: [],
  panel: null,
  searchOpen: false,
  saveStatus: "clean",
};

const none: CanvasEffect[] = [];

function result(state: CanvasSessionState, effects: CanvasEffect[] = none): CanvasReduceResult {
  return { state, effects };
}

export function sanitizeDocument(document: CanvasDocument): CanvasDocument {
  const elementIds = new Set<string>();
  const elements = document.elements.filter((element) => {
    if (elementIds.has(element.id)) return false;
    elementIds.add(element.id);
    return true;
  });
  const edges = document.edges.filter(
    (edge) => elementIds.has(edge.sourceElementId) && elementIds.has(edge.targetElementId),
  );
  if (elements.length === document.elements.length && edges.length === document.edges.length) {
    return document;
  }
  return { elements, edges };
}

export function panelForSelection(
  cellIds: string[],
  document: CanvasDocument,
  current: CanvasRightPanel,
): CanvasRightPanel {
  if (cellIds.length === 1) {
    const id = cellIds[0];
    if (document.edges.some((edge) => edge.id === id))
      return current?.mode === "library" ? current : null;
  }
  return current?.mode === "library" ? current : null;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function sameViewport(left: CanvasViewport | null, right: CanvasViewport): boolean {
  return Boolean(left && left.x === right.x && left.y === right.y && left.zoom === right.zoom);
}

function samePanel(left: CanvasRightPanel, right: CanvasRightPanel): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.mode === "library" && right.mode === "library") return true;
  return (
    left.mode === "detail" &&
    right.mode === "detail" &&
    left.understandingId === right.understandingId
  );
}

function resetSession(canvasId: string | null): CanvasSessionState {
  return { ...initialCanvasSession, canvasId };
}

export function reduceCanvasSession(
  state: CanvasSessionState,
  action: CanvasAction,
): CanvasReduceResult {
  switch (action.type) {
    case "session/opened": {
      if (state.canvasId === action.canvasId) return result(state);
      return result(resetSession(action.canvasId));
    }
    case "session/closed":
      if (state.canvasId === null && !state.hydrated) return result(state);
      return result(resetSession(null), [{ type: "flushSaves" }]);
    case "document/hydrated": {
      if (state.hydrated || state.canvasId === null) return result(state);
      return result({
        ...state,
        hydrated: true,
        snapshot: { document: action.document, viewport: action.viewport },
        document: action.document,
        viewport: action.viewport,
      });
    }
    case "document/changed": {
      const document = sanitizeDocument(action.document);
      return result({ ...state, document, saveStatus: "dirty" }, [
        { type: "saveDocument", document },
      ]);
    }
    case "viewport/changed": {
      if (sameViewport(state.viewport, action.viewport)) return result(state);
      return result({ ...state, viewport: action.viewport }, [
        { type: "saveViewport", viewport: action.viewport },
      ]);
    }
    case "selection/changed": {
      const panel = panelForSelection(action.cellIds, state.document, state.panel);
      if (sameIds(state.selection, action.cellIds) && samePanel(state.panel, panel)) {
        return result(state);
      }
      return result({ ...state, selection: action.cellIds, panel });
    }
    case "panel/toggleLibrary": {
      const panel: CanvasRightPanel = state.panel?.mode === "library" ? null : { mode: "library" };
      if (samePanel(state.panel, panel)) return result(state);
      return result({ ...state, panel });
    }
    case "panel/openDetail": {
      const panel: CanvasRightPanel = {
        mode: "detail",
        understandingId: action.understandingId,
      };
      if (samePanel(state.panel, panel)) return result(state);
      return result({ ...state, panel });
    }
    case "panel/close":
      if (state.panel === null) return result(state);
      return result({ ...state, panel: null });
    case "search/toggled":
      return result({ ...state, searchOpen: !state.searchOpen });
    case "search/closed":
      if (!state.searchOpen) return result(state);
      return result({ ...state, searchOpen: false });
    case "search/selected":
      return result({ ...state, searchOpen: false }, [{ type: "focusCell", id: action.id }]);
    case "save/status":
      if (state.saveStatus === action.status) return result(state);
      return result({ ...state, saveStatus: action.status });
    case "save/retry":
      return result(state, [{ type: "retrySave" }]);
  }
}
