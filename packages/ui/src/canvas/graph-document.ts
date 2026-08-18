import type { Edge, Graph, Node } from "@antv/x6";
import type { EdgeMetadata, NodeMetadata } from "@antv/x6";
import type { CanvasDocument, CanvasEdgeDTO, CanvasElementDTO } from "./document";

/**
 * X6 cell ↔ CanvasDocument 映射（计划 T3：元素 / 连线 id == X6 cell id，零映射）。
 *
 * - 每个 cell 的 `data` 即对应元素 / 连线的 DTO（不含派生字段），几何（x/y/宽高/zIndex）
 *   以 X6 为交互权威，读取时回刷；
 * - 建图 / 外部刷新用 `documentToGraphData` 生成 fromJSON 数据；
 * - 变更事件桥用 `graphToDocument` 重建全量文档（画布 5-50 卡，重建便宜）。
 */

export type CanvasGraphNodeData = CanvasElementDTO;
export type CanvasGraphEdgeData = CanvasEdgeDTO;

/** 元素 DTO → X6 node 元数据（fromJSON 使用）。 */
export function elementToNodeMeta(element: CanvasElementDTO, shape: string): NodeMetadata {
  return {
    id: element.id,
    shape,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    parent: element.parentId ?? undefined,
    data: element,
  };
}

/** 连线 DTO → X6 edge 元数据（fromJSON 使用）。 */
export function edgeToEdgeMeta(edge: CanvasEdgeDTO): EdgeMetadata {
  return {
    id: edge.id,
    source: edge.sourceElementId,
    target: edge.targetElementId,
    data: edge,
  };
}

/** 文档 → fromJSON 数据（初始加载 / 外部刷新）。 */
export function documentToGraphData(
  document: CanvasDocument,
  shapeOf: (element: CanvasElementDTO) => string,
) {
  return {
    nodes: document.elements.map((element) => elementToNodeMeta(element, shapeOf(element))),
    edges: document.edges.map(edgeToEdgeMeta),
  };
}

/** 节点 → 元素 DTO（几何以 X6 为准回刷）。 */
export function nodeToElement(node: Node): CanvasElementDTO {
  const data = node.getData<CanvasElementDTO>();
  const position = node.getPosition();
  const size = node.getSize();
  const parent = node.getParent();
  return {
    ...data,
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    parentId: parent?.id ?? null,
    zIndex: node.getZIndex() ?? data.zIndex,
  };
}

/** 边 → 连线 DTO。 */
export function edgeToEdge(edge: Edge): CanvasEdgeDTO {
  return edge.getData<CanvasEdgeDTO>();
}

/** 重建全量文档（事件桥：X6 手势后回写 store / 提交 saveCanvas）。 */
export function graphToDocument(graph: Graph): CanvasDocument {
  return {
    elements: graph.getNodes().map(nodeToElement),
    edges: graph.getEdges().map(edgeToEdge),
  };
}
