/**
 * 画布文档契约（跨 server / UI / CLI 共享的 wire format）。
 *
 * 单一真源：server 侧 normalize/validate/layout、UI 侧渲染、CLI 创建都认这里的
 * 形状。元素 / 连线 id 零映射；`x/y/width/height` 中「组内子元素为相对坐标」，
 * UI 渲染时换算成绝对坐标（见 UI graph-document 注释）。
 */

export type CanvasElementKind = "understanding" | "text" | "group" | "canvas_ref";

/** 呈现状态（防误拖锁定）随 props 走，非业务状态（C5） */
export type CanvasElementPropsMap = {
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

/** 判别联合：kind 收窄 props 与引用字段 */
export type CanvasElementDTO = {
  [K in CanvasElementKind]: CanvasElementBase & {
    kind: K;
    understandingId: K extends "understanding" ? string | null : null;
    canvasRefId: K extends "canvas_ref" ? string | null : null;
    props: CanvasElementPropsMap[K];
  };
}[CanvasElementKind];

/** 与 X6 attrs 同构；selector 名和属性均原样持久化。 */
export type CanvasEdgeAttrs = Record<string, Record<string, unknown>>;

export type CanvasEdgePortId = "top" | "right" | "bottom" | "left";

export type CanvasEdgeRouter = {
  name: "normal" | "orth" | "oneSide" | "manhattan" | "metro" | "er" | "reflecta-curve";
  args?: Record<string, unknown>;
};

export type CanvasEdgeConnector = {
  name: "normal" | "smooth" | "rounded" | "jumpover" | "reflecta-curve";
  args?: Record<string, unknown>;
};

/** 与 X6 Edge terminal 同构。 */
export type CanvasEdgeTerminal = {
  cell: string;
  port: CanvasEdgePortId;
};

export type CanvasEdgeDTO = {
  id: string;
  canvasId: string;
  source: CanvasEdgeTerminal;
  target: CanvasEdgeTerminal;
  router: CanvasEdgeRouter | null;
  connector: CanvasEdgeConnector;
  attrs: CanvasEdgeAttrs;
  label: string | null;
  createdAt: string;
};

/** saveCanvas 的唯一参数（与读出的 detail 内容同构） */
export type CanvasDocument = {
  elements: CanvasElementDTO[];
  edges: CanvasEdgeDTO[];
};

export type CanvasViewport = { x: number; y: number; zoom: number };

/** 空文档 */
export const EMPTY_CANVAS_DOCUMENT: CanvasDocument = { elements: [], edges: [] };

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 };

// --- 画布 detail / 输入 DTO（可变规范类型；运行时 schema 见 ./schema） ----------

export type CanvasDTO = {
  id: string;
  title: string;
  description: string | null;
  viewport: CanvasViewport | null;
  createdAt: string;
  updatedAt: string;
};

export type CanvasUnderstandingRef = {
  id: string;
  title: string | null;
  body: string;
  deleted: boolean;
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

export type GetCanvasDetailOptions = {
  includeBodies?: boolean;
};

export type CreateCanvasInput = {
  title?: string;
};

export type UpdateCanvasInput = {
  title?: string;
  description?: string | null;
  viewport?: CanvasViewport | null;
};
