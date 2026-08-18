import { createContext, useContext } from "react";

/**
 * react-shape 节点展示数据的注入通道。
 *
 * 元素 DTO 的 `data` 只承载文档契约（零映射）；卡片展示所需的派生数据
 * （理解卡的标题 / 正文 / 删除占位、画布引用卡的目标画布标题 / 占位）由
 * 上层（workspace）从详情查询结果构造为 map 注入，M3-A6 / M6-3 同步只刷
 * 上下文，不重载画布文档（不丢布局）。
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
  /** 引用理解（画布上理解卡展示全文） */
  understandingRefs: ReadonlyMap<string, CanvasUnderstandingRefView>;
  /** 引用画布（画布引用卡展示目标标题；目标被删 → 占位） */
  referencedCanvases: ReadonlyMap<string, CanvasReferencedCanvasView>;
  /** 画布引用卡点击跳转（由 workspace 注入 navigateToCanvas） */
  onCanvasRefClick?: (canvasId: string) => void;
  /** 组 / 卡片右键动作（删除组级联、解除组等，由 workspace 操作 X6 图） */
  onCellAction?: (action: CanvasCellAction) => void;
};

export type CanvasCellAction =
  | { type: "delete-group"; nodeId: string }
  | { type: "ungroup"; nodeId: string };

export const EMPTY_CANVAS_SHAPE_DATA: CanvasShapeData = {
  understandingRefs: new Map(),
  referencedCanvases: new Map(),
};

const CanvasShapeContext = createContext<CanvasShapeData>(EMPTY_CANVAS_SHAPE_DATA);

export const CanvasShapeDataProvider = CanvasShapeContext.Provider;

export function useCanvasShapeData(): CanvasShapeData {
  return useContext(CanvasShapeContext);
}
