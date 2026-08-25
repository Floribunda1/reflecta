import type { InferSelectModel } from "drizzle-orm";
import type {
  understandingCanvases,
  understandingCanvasEdges,
  understandingCanvasElements,
} from "../../db/schema";

export type UnderstandingCanvas = InferSelectModel<typeof understandingCanvases>;
export type UnderstandingCanvasElement = InferSelectModel<typeof understandingCanvasElements>;
export type UnderstandingCanvasEdge = InferSelectModel<typeof understandingCanvasEdges>;

// --- 文档契约（单一真源在 @reflecta/shared）-----------------------------------
// UI 渲染、server normalize/validate/layout、CLI 创建共用同一份 wire format。
// 消费者直接引 `@reflecta/shared`，本文件不再 re-export，避免兼容 shim。
import type { CanvasElementDTO, CanvasEdgeDTO } from "@reflecta/shared/canvas/document";

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

// --- 输入 ----------------------------------------------------------------------

export type CreateCanvasInput = {
  title?: string;
};

export type UpdateCanvasInput = {
  title?: string;
};
