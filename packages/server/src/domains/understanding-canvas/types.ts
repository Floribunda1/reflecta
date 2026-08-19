import type { InferSelectModel } from "drizzle-orm";
import type {
  understandingCanvases,
  understandingCanvasEdges,
  understandingCanvasElements,
} from "../../db/schema";

export type UnderstandingCanvas = InferSelectModel<typeof understandingCanvases>;
export type UnderstandingCanvasElement = InferSelectModel<typeof understandingCanvasElements>;
export type UnderstandingCanvasEdge = InferSelectModel<typeof understandingCanvasEdges>;

// --- 元素判别联合（kind 收窄 props 与引用字段） ---------------------------------

export type CanvasElementKind = "understanding" | "text" | "group" | "canvas_ref";

export type ElementPropsMap = {
  understanding: { color?: string };
  text: { text: string; color?: string };
  group: { label: string; color?: string };
  canvas_ref: { color?: string };
};

export type CanvasElementBase = {
  id: string;
  canvasId: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
};

/** DTO 判别联合：kind 收窄 props 与引用字段（无意义组合在类型层面不可能） */
export type CanvasElementDTO = {
  [K in CanvasElementKind]: CanvasElementBase & {
    kind: K;
    understandingId: K extends "understanding" ? string | null : null;
    canvasRefId: K extends "canvas_ref" ? string | null : null;
    props: ElementPropsMap[K];
  };
}[CanvasElementKind];

// --- 连线样式（社区四维模型） ---------------------------------------------------

export type EdgeStyle = {
  routing?: "straight" | "curve" | "orthogonal";
  lineStyle?: "solid" | "dashed" | "dotted";
  color?: string;
  width?: "thin" | "medium" | "thick";
  arrowhead?: "arrow" | "block" | "none";
};

export type CanvasEdgeDTO = {
  id: string;
  canvasId: string;
  sourceElementId: string;
  targetElementId: string;
  label: string | null;
  style: EdgeStyle | null;
  createdAt: string;
};

// --- 画布 DTO ------------------------------------------------------------------

export type CanvasDTO = {
  id: string;
  title: string;
  description: string | null;
  viewport: { x: number; y: number; zoom: number } | null;
  createdAt: string;
  updatedAt: string;
};

export type CanvasUnderstandingRef = {
  id: string;
  title: string | null;
  body: string;
  deleted: boolean;
};

export type CanvasHit = {
  canvas: CanvasDTO;
  snippet: string;
  reason: string;
};

export type SearchCanvasesInput = {
  query?: string;
  understandingId?: string;
  limit?: number;
};

export type ListCanvasesFilter = {
  titleSearchKeyword?: string;
  limit?: number;
};

export type GetCanvasDetailOptions = {
  /** 骨架默认（Agent / CLI 契约）：引用理解只返回标题；renderer 显式传 true 拿正文 */
  includeBodies?: boolean;
};

export type CanvasReferencedCanvas = {
  id: string;
  title: string;
  deleted: boolean;
};

export type CanvasDetailDTO = {
  canvas: CanvasDTO;
  elements: CanvasElementDTO[];
  edges: CanvasEdgeDTO[];
  understandingRefs: CanvasUnderstandingRef[];
  referencedCanvases: CanvasReferencedCanvas[];
};

/** saveCanvas 的唯一参数（与读出的 CanvasDetailDTO 内容同构，不含服务端派生字段） */
export type CanvasDocument = {
  elements: CanvasElementDTO[];
  edges: CanvasEdgeDTO[];
};

// --- 输入 ----------------------------------------------------------------------

export type CreateCanvasInput = {
  title?: string;
};

export type UpdateCanvasInput = {
  title?: string;
};

export type Viewport = { x: number; y: number; zoom: number };
