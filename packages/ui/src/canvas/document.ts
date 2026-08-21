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

export type CanvasEdgeStyle = {
  /** 形状：曲线=connector smooth；直线=connector normal；正交=router orth + connector rounded */
  routing?: "straight" | "curve" | "orthogonal";
  /** 线型：映射 X6 line.strokeDasharray（虚线 5 5 / 点线 2 2） */
  lineStyle?: "solid" | "dashed" | "dotted";
  color?: string;
  /** 线宽：映射 X6 line.strokeWidth（细 2 / 中 3 / 粗 4） */
  width?: "thin" | "medium" | "thick";
  /** 箭头：与 X6 内建 marker 一一对应（arrow→classic，其余同名校）；none→targetMarker null */
  arrowhead?: "arrow" | "block" | "circle" | "diamond" | "cross" | "ellipse" | "none";
};

export const DEFAULT_CANVAS_EDGE_STYLE: CanvasEdgeStyle = {
  routing: "curve",
  lineStyle: "solid",
  width: "thin",
  arrowhead: "arrow",
};

export type CanvasEdgeDTO = {
  id: string;
  canvasId: string;
  sourceElementId: string;
  targetElementId: string;
  label: string | null;
  style: CanvasEdgeStyle | null;
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
