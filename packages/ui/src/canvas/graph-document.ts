import { MarkerType } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { CSSProperties } from "react";
import { canvasPaintColor } from "./color-swatches";
import {
  DEFAULT_CANVAS_EDGE_STYLE,
  type CanvasDocument,
  type CanvasEdgeDTO,
  type CanvasElementDTO,
} from "./document";

/**
 * CanvasDocument ↔ React Flow 映射。
 *
 * - id == React Flow node/edge id（零映射不变式）；
 * - 每个 node/edge 的 `data` 即对应元素的 DTO；几何（position / width / height）以
 *   React Flow 为交互权威，回读时回刷（组内子元素 position 为相对父坐标，React Flow
 *   与文档模型一致）；
 * - 建图 / 刷新用 `toFlowNodes / toFlowEdges`；变更回写用 `toCanvasDocument`。
 */

/**
 * 组外壳画在 RF 的 `.react-flow__node-group` 上。有 paint 时把官方边框/底/选中
 * 阴影涂成该色；无 paint 时不写 inline style，走画布上覆盖的 token 变量。
 */
export function toGroupNodeStyle(element: CanvasElementDTO): CSSProperties | undefined {
  if (element.kind !== "group") return undefined;
  const paint = canvasPaintColor(element.props.color);
  if (!paint) return undefined;
  return {
    borderColor: paint,
    backgroundColor: `color-mix(in srgb, ${paint} 10%, transparent)`,
    ["--xy-node-boxshadow-selected" as string]: `0 0 0 2px ${paint}`,
    ["--xy-node-boxshadow-hover" as string]: `0 0 0 2px ${paint}`,
  };
}

/** 元素 DTO → React Flow node。 */
export function toFlowNode(element: CanvasElementDTO): Node {
  return {
    id: element.id,
    type: element.kind,
    position: { x: element.x, y: element.y },
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    parentId: element.parentId ?? undefined,
    extent: element.parentId ? "parent" : undefined,
    expandParent: element.parentId ? true : undefined,
    style: toGroupNodeStyle(element),
    data: { element },
  };
}

/** 连线 DTO → React Flow edge。 */
export function toFlowEdge(edge: CanvasEdgeDTO): Edge {
  const style = edge.style ?? DEFAULT_CANVAS_EDGE_STYLE;
  const color = canvasPaintColor(style.color) ?? "var(--muted-foreground)";
  const arrowhead =
    style.arrowhead === "block"
      ? MarkerType.ArrowClosed
      : style.arrowhead === "arrow"
        ? MarkerType.Arrow
        : undefined;
  return {
    id: edge.id,
    type: "canvas",
    source: edge.sourceElementId,
    target: edge.targetElementId,
    data: { edge },
    style: {
      stroke: color,
      strokeWidth: style.width === "thick" ? 4 : style.width === "medium" ? 3 : 2,
      strokeDasharray:
        style.lineStyle === "dashed" ? "5 5" : style.lineStyle === "dotted" ? "2 2" : undefined,
    } satisfies CSSProperties,
    // 箭头必须用对象形式（含 color），RF 才会为它创建 marker def；
    // 裸的 MarkerType 字符串只当引用不存在的 id，箭头不渲染。
    markerEnd: arrowhead ? { type: arrowhead, color } : undefined,
  };
}

/** 新建连线的初始 DTO（onConnect 时 source/target 由交互补齐）。 */
export function newEdgeDto(canvasId: string): CanvasEdgeDTO {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    canvasId,
    sourceElementId: "",
    targetElementId: "",
    label: null,
    style: { ...DEFAULT_CANVAS_EDGE_STYLE },
    createdAt: now,
  };
}

/** 文档 → React Flow nodes/edges（初始加载 / 外部刷新）。 */
export function toFlowData(document: CanvasDocument) {
  const elements = document.elements;
  const byId = new Map(elements.map((element) => [element.id, element]));
  const ordered: CanvasElementDTO[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (element: CanvasElementDTO) => {
    if (visited.has(element.id)) return;
    if (visiting.has(element.id)) return;
    visiting.add(element.id);
    if (element.parentId) {
      const parent = byId.get(element.parentId);
      if (parent) visit(parent);
    }
    visiting.delete(element.id);
    visited.add(element.id);
    ordered.push(element);
  };

  elements.forEach(visit);
  return {
    nodes: ordered.map(toFlowNode),
    edges: document.edges.map(toFlowEdge),
  };
}

/** React Flow node → 元素 DTO（几何以 RF 为权威回刷；id 取 node id）。 */
function nodeToElement(node: Node): CanvasElementDTO {
  const data = (node.data as { element?: CanvasElementDTO }).element;
  const base = data ?? ({} as CanvasElementDTO);
  return {
    ...base,
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? base.width,
    height: node.measured?.height ?? node.height ?? base.height,
    zIndex: node.zIndex ?? base.zIndex,
    parentId: node.parentId ?? null,
  };
}

/** React Flow edge → 连线 DTO（source/target 以 RF 连接回刷）。 */
function edgeToEdge(edge: Edge): CanvasEdgeDTO {
  const data = (edge.data as { edge?: CanvasEdgeDTO }).edge;
  const base = data ?? ({} as CanvasEdgeDTO);
  return {
    ...base,
    id: edge.id,
    sourceElementId: edge.source,
    targetElementId: edge.target,
  };
}

/** 用 React Flow 当前 nodes/edges 重建全量文档（事件回写）。 */
export function toCanvasDocument(nodes: Node[], edges: Edge[]): CanvasDocument {
  return {
    elements: nodes.map(nodeToElement),
    edges: edges.map(edgeToEdge),
  };
}
