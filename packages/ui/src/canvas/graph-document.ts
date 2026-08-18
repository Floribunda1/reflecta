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

/** 所有元素节点共用 4 个边缘端口（M4-1 吸附锚点：上下左右），magnet 供连线拖出。 */
export const CANVAS_EDGE_PORTS = {
  groups: {
    edges: {
      position: {
        name: "ellipseSpread" as const,
        args: { start: 0, step: 90, compensateRotate: true },
      },
      attrs: {
        portBody: {
          magnet: true,
          width: 8,
          height: 8,
          x: -4,
          y: -4,
          rx: 4,
          ry: 4,
          fill: "var(--primary)",
          stroke: "none",
          opacity: 0,
        },
        portLabel: { style: { visibility: "hidden" } },
      },
      markup: [{ tagName: "rect", selector: "portBody" }],
    },
  },
  items: [{ group: "edges" }, { group: "edges" }, { group: "edges" }, { group: "edges" }],
};

/** 元素 DTO → X6 node 元数据（fromJSON / 新建使用）。 */
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
    ports: CANVAS_EDGE_PORTS,
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

/** 新建边的初始 DTO（连线时 source/target 由 X6 交互补齐）。 */
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

/** 节点 → 元素 DTO（几何以 X6 为准回刷）。
 *
 * id 一律取 X6 cell id（真正的零映射不变式）。DnD 落点可能为克隆节点分配新 id，
 * 与 DTO data.id 不一致；以 cell id 为准，连线 source/target（getSourceCellId）才能对上。 */
export function nodeToElement(node: Node): CanvasElementDTO {
  const data = node.getData<CanvasElementDTO>();
  const position = node.getPosition();
  const size = node.getSize();
  const parent = node.getParent();
  return {
    ...data,
    id: node.id,
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    parentId: parent?.id ?? null,
    zIndex: node.getZIndex() ?? data.zIndex,
  };
}

/** 边 → 连线 DTO（source/target 以 X6 交互连接回刷，label/style 存于 data）。 */
export function edgeToEdge(edge: Edge): CanvasEdgeDTO {
  const data = edge.getData<CanvasEdgeDTO>();
  return {
    ...data,
    sourceElementId: edge.getSourceCellId() ?? data.sourceElementId,
    targetElementId: edge.getTargetCellId() ?? data.targetElementId,
  };
}

/** 重建全量文档（事件桥：X6 手势后回写 store / 提交 saveCanvas）。 */
export function graphToDocument(graph: Graph): CanvasDocument {
  return {
    elements: graph.getNodes().map(nodeToElement),
    edges: graph.getEdges().map(edgeToEdge),
  };
}
