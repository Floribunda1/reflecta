import { create } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { CanvasDocument, CanvasViewport } from "@reflecta/ui/canvas";

/**
 * 画布文档 store（计划 §2）：X6 为交互 / 语义权威，本 store 是其镜像数据源。
 *
 * - `document`：当前画布全量文档（元素 / 连线 id == X6 cell id，零映射）；
 *   事件桥（X6 变更 → 回写）+ 外部失效（Phase 5 审批应用 → fromJSON）双向维护；
 * - `viewport`：M1-5 恢复 / updateViewport 提交；
 * - `selection`：选中 cell id 集合，右侧面板 / 搜索消费；
 * - 撤销重做由 X6 History 插件会话内处理，不落本 store。
 */

export type CanvasStoreState = {
  selectedCanvasId: string | null;
  document: CanvasDocument;
  viewport: CanvasViewport | null;
  selection: string[];
};

export type CanvasStoreActions = {
  /** 打开 / 关闭画布；切换时清空文档镜像与会话态 */
  selectCanvas: (canvasId: string | null) => void;
  /** 事件桥回写：X6 变更后的完整文档状态（防抖 saveCanvas 由上层负责） */
  setDocument: (document: CanvasDocument) => void;
  /** 视口变更 settle 后回写（updateViewport） */
  setViewport: (viewport: CanvasViewport) => void;
  setSelection: (cellIds: string[]) => void;
  reset: () => void;
};

export type CanvasStore = CanvasStoreState & CanvasStoreActions;

export const initialCanvasState: CanvasStoreState = {
  selectedCanvasId: null,
  document: { elements: [], edges: [] },
  viewport: null,
  selection: [],
};

type CanvasSet = StoreApi<CanvasStore>["setState"];

function createCanvasState(set: CanvasSet, initialState: CanvasStoreState): CanvasStore {
  return {
    ...initialState,
    selectCanvas: (canvasId) =>
      set(() => ({
        selectedCanvasId: canvasId,
        document: { elements: [], edges: [] },
        viewport: null,
        selection: [],
      })),
    setDocument: (document) => set({ document }),
    setViewport: (viewport) => set({ viewport }),
    setSelection: (cellIds) => set({ selection: cellIds }),
    reset: () => set({ ...initialCanvasState }),
  };
}

// 便于单测 / 多实例（e.g. 只读预览不共享交互态）
export function createCanvasStore(initialState: CanvasStoreState = initialCanvasState) {
  return createStore<CanvasStore>()((set) => createCanvasState(set, initialState));
}

export const useCanvasStore = create<CanvasStore>()((set) =>
  createCanvasState(set, initialCanvasState),
);

export type CanvasStoreApi = StoreApi<CanvasStore>;
