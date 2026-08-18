import { create } from "zustand";
import type { CanvasDTO, CanvasDetailDTO, Viewport } from "@reflecta/server";
import {
  WIREFRAME_CANVASES,
  WIREFRAME_CANVAS_DETAILS,
  WIREFRAME_UNDERSTANDINGS,
  type LibraryItem,
} from "./wireframe-data";

/**
 * 画布线框本地 store（纯前端 mock，不连后端）。
 *
 * 覆盖三类状态：资源层（画布列表 CRUD）、画布层（元素选择 / 视口 pan-zoom）、
 * 右侧单面板（库 / 详情互斥 + 展开状态）。后续接真实后端时，
 * 资源层换成 react-query + IPC，画布层保留。
 */

export type RightPanelMode = "library" | "detail";

export type DetailTarget =
  | { kind: "element"; elementId: string }
  | { kind: "library"; item: LibraryItem };

type CanvasWireframeState = {
  canvases: CanvasDTO[];
  details: Record<string, CanvasDetailDTO>;
  selectedCanvasId: string | null;
  /** 画布上被选中的元素（驱动选中高亮） */
  selectedElementId: string | null;
  /** 右侧详情模式渲染哪个对象（元素实体 或 素材库条目） */
  detailTarget: DetailTarget | null;
  rightPanelOpen: boolean;
  rightPanelMode: RightPanelMode;
  /** 每个画布的视口（pan / zoom），初始缺省由画布侧首开时 auto-fit 填充 */
  viewports: Record<string, Viewport>;
  /** 已做过 auto-fit 的画布（避免每次切换都重置视口） */
  fittedCanvasIds: string[];
  searchOpen: boolean;

  selectCanvas: (canvasId: string) => void;
  createCanvas: () => string;
  renameCanvas: (canvasId: string, title: string) => void;
  deleteCanvas: (canvasId: string) => void;

  selectElement: (canvasId: string, elementId: string) => void;
  clearSelection: () => void;
  openLibrary: () => void;
  inspectLibraryItem: (item: LibraryItem) => void;
  setRightPanelOpen: (open: boolean) => void;

  setViewport: (canvasId: string, viewport: Viewport) => void;
  markFitted: (canvasId: string) => void;
  setSearchOpen: (open: boolean) => void;
};

function nextCanvasTitle(existing: readonly CanvasDTO[]): string {
  const count = existing.length + 1;
  const used = new Set(existing.map((canvas) => canvas.title));
  let title = `未命名画布 ${count}`;
  let seed = count;
  while (used.has(title)) {
    seed += 1;
    title = `未命名画布 ${seed}`;
  }
  return title;
}

const nowIso = () => new Date().toISOString();

export const useCanvasWireframeStore = create<CanvasWireframeState>((set, get) => ({
  canvases: [...WIREFRAME_CANVASES],
  details: { ...WIREFRAME_CANVAS_DETAILS },
  selectedCanvasId: WIREFRAME_CANVASES[0]?.id ?? null,
  selectedElementId: null,
  detailTarget: null,
  rightPanelOpen: true,
  rightPanelMode: "library",
  viewports: {},
  fittedCanvasIds: [],
  searchOpen: false,

  selectCanvas: (canvasId) =>
    set({
      selectedCanvasId: canvasId,
      selectedElementId: null,
      detailTarget: null,
      rightPanelOpen: true,
      rightPanelMode: "library",
      searchOpen: false,
    }),

  createCanvas: () => {
    const title = nextCanvasTitle(get().canvases);
    const id = `c-${Date.now()}`;
    const canvas: CanvasDTO = {
      id,
      title,
      description: "",
      viewport: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    set((state) => ({
      canvases: [canvas, ...state.canvases],
      details: {
        ...state.details,
        [id]: { canvas, elements: [], edges: [], understandingRefs: [], referencedCanvases: [] },
      },
      selectedCanvasId: id,
      selectedElementId: null,
      detailTarget: null,
      rightPanelOpen: true,
      rightPanelMode: "library",
    }));
    return id;
  },

  renameCanvas: (canvasId, title) =>
    set((state) => ({
      canvases: state.canvases.map((canvas) =>
        canvas.id === canvasId
          ? { ...canvas, title, description: canvas.description, updatedAt: nowIso() }
          : canvas,
      ),
      details: state.details[canvasId]
        ? {
            ...state.details,
            [canvasId]: {
              ...state.details[canvasId]!,
              canvas: { ...state.details[canvasId]!.canvas, title },
            },
          }
        : state.details,
    })),

  deleteCanvas: (canvasId) =>
    set((state) => {
      const remaining = state.canvases.filter((canvas) => canvas.id !== canvasId);
      const details = { ...state.details };
      delete details[canvasId];
      const viewports = { ...state.viewports };
      delete viewports[canvasId];
      const fittedCanvasIds = state.fittedCanvasIds.filter((id) => id !== canvasId);
      const deletedSelected = state.selectedCanvasId === canvasId;
      return {
        canvases: remaining,
        details,
        viewports,
        fittedCanvasIds,
        selectedCanvasId: deletedSelected ? (remaining[0]?.id ?? null) : state.selectedCanvasId,
        selectedElementId: deletedSelected ? null : state.selectedElementId,
        detailTarget: deletedSelected ? null : state.detailTarget,
      };
    }),

  selectElement: (canvasId, elementId) =>
    set({
      selectedCanvasId: canvasId,
      selectedElementId: elementId,
      detailTarget: { kind: "element", elementId },
      rightPanelOpen: true,
      rightPanelMode: "detail",
    }),

  clearSelection: () =>
    set((state) => ({
      selectedElementId: null,
      // 清空画布选择时回到库模式 —— 单面板互斥切换的默认落点
      detailTarget: null,
      rightPanelMode: state.rightPanelOpen ? "library" : state.rightPanelMode,
    })),

  openLibrary: () =>
    set({
      detailTarget: null,
      rightPanelMode: "library",
      rightPanelOpen: true,
    }),

  inspectLibraryItem: (item) =>
    set({
      detailTarget: { kind: "library", item },
      rightPanelMode: "detail",
      rightPanelOpen: true,
    }),

  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

  setViewport: (canvasId, viewport) =>
    set((state) => ({
      viewports: { ...state.viewports, [canvasId]: viewport },
    })),

  markFitted: (canvasId) =>
    set((state) => ({
      fittedCanvasIds: state.fittedCanvasIds.includes(canvasId)
        ? state.fittedCanvasIds
        : [...state.fittedCanvasIds, canvasId],
    })),

  setSearchOpen: (open) => set({ searchOpen: open }),
}));

// ─── 派生查询（组件共享，无需 selector 重复实现） ─────────────────────────────

export function selectCanvasDetail(
  state: Pick<CanvasWireframeState, "details" | "selectedCanvasId">,
): CanvasDetailDTO | null {
  return state.selectedCanvasId ? (state.details[state.selectedCanvasId] ?? null) : null;
}

export function selectElementById(detail: CanvasDetailDTO | null, elementId: string | null) {
  if (!detail || !elementId) return null;
  return detail.elements.find((element) => element.id === elementId) ?? null;
}

/** 画布内搜索用的元素可读标题（理解卡 / 文本 / 形状 / 组 / 画布引用） */
export function elementSearchTitle(detail: CanvasDetailDTO, elementId: string): string {
  const element = detail.elements.find((item) => item.id === elementId);
  if (!element) return "";
  switch (element.kind) {
    case "understanding":
      return WIREFRAME_UNDERSTANDINGS[element.understandingId ?? ""]?.title ?? "理解";
    case "text":
      return element.props.text;
    case "shape":
      return element.props.shapeType === "circle" ? "圆形" : "矩形";
    case "group":
      return element.props.label;
    case "canvas_ref": {
      const ref = detail.referencedCanvases.find((canvas) => canvas.id === element.canvasRefId);
      return ref?.title ?? "画布引用";
    }
  }
}
