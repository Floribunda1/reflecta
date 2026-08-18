import type { Edge, Node } from "@xyflow/react";
import type { CanvasDocument, CanvasEdgeDTO, CanvasElementDTO } from "./document";

/**
 * CanvasDocument ↔ React Flow 映射。
 *
 * - id == React Flow node/edge id（零映射不变式）；
 * - 每个 node/edge 的 `data` 即对应元素的 DTO；几何（position / width / height）以
 *   React Flow 为交互权威，回读时回刷（组内子元素 position 为相对父坐标，React Flow
 *   与文档模型一致）；
 * - 建图 / 刷新用 `toFlowNodes / toFlowEdges`；变更回写用 `toCanvasDocument`。
 */

/** 元素 DTO → React Flow node。 */
export function toFlowNode(element: CanvasElementDTO): Node {
  return {
    id: element.id,
    type: element.kind,
    position: { x: element.x, y: element.y },
    width: element.width,
    height: element.height,
    parentId: element.parentId ?? undefined,
    data: { element },
  };
}

/** 连线 DTO → React Flow edge。 */
export function toFlowEdge(edge: CanvasEdgeDTO): Edge {
  return {
    id: edge.id,
    source: edge.sourceElementId,
    target: edge.targetElementId,
    data: { edge },
    label: edge.label ?? undefined,
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
    style: null,
    createdAt: now,
  };
}

/** 文档 → React Flow nodes/edges（初始加载 / 外部刷新）。 */
export function toFlowData(document: CanvasDocument) {
  return {
    nodes: document.elements.map(toFlowNode),
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
