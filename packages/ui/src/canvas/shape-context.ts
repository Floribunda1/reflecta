import { createContext, useContext } from "react";
import type { CanvasElementDTO } from "./document";
import type { CanvasEdgeDTO } from "./document";

/**
 * 节点展示数据与编辑回写通道。
 *
 * React Flow 自定义节点渲染在当前 React 树内，context 直接穿透——卡片所需的派生
 * 展示数据（理解卡全文、引用标题、删除占位）和内容编辑回写都走这里，无需引擎级 hack。
 */

export type CanvasUnderstandingRefView = {
  id: string;
  title: string | null;
  body: string;
  deleted: boolean;
};

export type CanvasReferencedCanvasView = {
  id: string;
  title: string;
  deleted: boolean;
};

export type CanvasShapeData = {
  /** 只读画布禁用节点自身的编辑与操作菜单 */
  readonly?: boolean;
  /** 引用理解（画布上理解卡展示全文） */
  understandingRefs: ReadonlyMap<string, CanvasUnderstandingRefView>;
  /** 引用画布（画布引用卡展示目标标题；目标被删 → 占位） */
  referencedCanvases: ReadonlyMap<string, CanvasReferencedCanvasView>;
  /** 画布引用卡点击跳转（由 workspace 注入 navigateToCanvas） */
  onCanvasRefClick?: (canvasId: string) => void;
  onCellAction?: (action: CanvasCellAction) => void;
  onElementEdit?: (element: CanvasElementDTO) => void;
};

export type CanvasCellAction =
  | { type: "delete-element"; nodeId: string }
  | { type: "delete-group"; nodeId: string }
  | { type: "ungroup"; nodeId: string }
  | { type: "delete-edge"; edgeId: string };

export const EMPTY_CANVAS_SHAPE_DATA: CanvasShapeData = {
  understandingRefs: new Map(),
  referencedCanvases: new Map(),
};

const CanvasShapeContext = createContext<CanvasShapeData>(EMPTY_CANVAS_SHAPE_DATA);

export const CanvasShapeDataProvider = CanvasShapeContext.Provider;

export function useCanvasShapeData(): CanvasShapeData {
  return useContext(CanvasShapeContext);
}

/** 节点内容编辑（文本 / 组名）提交回写：把新 DTO 交给 CanvasGraph 更新受控数据并同步文档。 */
const CanvasElementUpdateContext = createContext<(element: CanvasElementDTO) => void>(() => {});

export const CanvasElementUpdateProvider = CanvasElementUpdateContext.Provider;

export function useCanvasElementUpdate(): (element: CanvasElementDTO) => void {
  return useContext(CanvasElementUpdateContext);
}

const CanvasEdgeUpdateContext = createContext<(edge: CanvasEdgeDTO) => void>(() => {});

export const CanvasEdgeUpdateProvider = CanvasEdgeUpdateContext.Provider;

export function useCanvasEdgeUpdate(): (edge: CanvasEdgeDTO) => void {
  return useContext(CanvasEdgeUpdateContext);
}
