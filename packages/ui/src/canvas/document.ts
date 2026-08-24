/**
 * 画布文档契约类型（ui 包本地视图模型）。
 *
 * 与 `@reflecta/server` 的 CanvasDocument / CanvasElementDTO / CanvasEdgeDTO
 * 结构同构（见 server `domains/understanding-canvas/types.ts`）；ui 包不依赖
 * server 包，契约漂移由 electron renderer 边界（IPC 层）做结构校验兜底。
 * 渲染层（React Flow）与文档层只认这里的形状：元素 / 连线 id 零映射。
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
  name: "normal" | "orth" | "oneSide" | "manhattan" | "metro" | "er";
  args?: Record<string, unknown>;
};

export type CanvasEdgeConnector = {
  name: "normal" | "smooth" | "rounded" | "jumpover";
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

/** saveCanvas 的唯一参数（与读出的 detail 内容同构，不含服务端派生字段） */
export type CanvasDocument = {
  elements: CanvasElementDTO[];
  edges: CanvasEdgeDTO[];
};

export type CanvasViewport = { x: number; y: number; zoom: number };

/** 空文档 */
export const EMPTY_CANVAS_DOCUMENT: CanvasDocument = { elements: [], edges: [] };

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 };
