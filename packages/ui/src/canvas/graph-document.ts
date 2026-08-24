import type { Edge as X6Edge, EdgeMetadata } from "@antv/x6";
import { Edge as X6EdgeCtor, type Graph, type Node as X6Node, type NodeMetadata } from "@antv/x6";
import type {
  CanvasDocument,
  CanvasEdgeAttrs,
  CanvasEdgeConnector,
  CanvasEdgeDTO,
  CanvasEdgeRouter,
  CanvasElementDTO,
} from "./document";
import { absolutePositionOf } from "./graph-operations";
import { CANVAS_PORTS } from "./ports";

/**
 * CanvasDocument ↔ X6 序列化（纯函数、强 FP）。
 *
 * 不变量：`element.id == cell.id`、`edge.id == edge cell id`（零映射）。
 * X6 model 以「绝对坐标」存储（子节点绝对于画布原点，随父移动由引擎计算）；
 * 我们的文档契约用「组内子元素相对坐标」——所以这里做相对↔绝对换算：
 *   - 写入 X6：把文档里的相对坐标转成绝对坐标；
 *   - 读回文档：用 X6 `getPosition({relative:true})` 拿相对坐标。
 */

type CellMetadata = NodeMetadata | EdgeMetadata;

/** 元素相对坐标 → 绝对坐标（沿 parentId 链累加）。用于 X6 写入。 */
const toAbsolute = (
  element: CanvasElementDTO,
  index: ReadonlyMap<string, CanvasElementDTO>,
): { x: number; y: number } => {
  return absolutePositionOf(element, index);
};

export const DEFAULT_CANVAS_EDGE_CONNECTOR: CanvasEdgeConnector = { name: "smooth" };
export const DEFAULT_CANVAS_EDGE_ATTRS: CanvasEdgeAttrs = {
  line: {
    stroke: "var(--muted-foreground)",
    strokeWidth: 2,
    targetMarker: { name: "classic", width: 10, height: 8 },
  },
  lines: { connection: true, strokeLinejoin: "round" },
  wrap: { strokeWidth: 10 },
};

function edgeLabelItems(label: string | null, color: string) {
  return label
    ? [
        {
          attrs: {
            body: { fill: "var(--background)", stroke: "none" },
            label: { text: label, fill: color, fontSize: 12 },
          },
        },
      ]
    : [];
}

function edgeLabels(edge: CanvasEdgeDTO) {
  const stroke = edge.attrs.line?.stroke;
  const color = typeof stroke === "string" ? stroke : "var(--muted-foreground)";
  return edgeLabelItems(edge.label, color);
}

function edgeVisuals(edge: CanvasEdgeDTO) {
  return {
    router: edge.router,
    connector: edge.connector,
    attrs: edge.attrs,
    labels: edgeLabels(edge),
  };
}

/** 单个元素 → X6 节点 metadata（相对→绝对坐标；供 fromJSON 与 Dnd 拖拽 phantom 复用）。 */
export function nodeMetadataFor(
  element: CanvasElementDTO,
  index: ReadonlyMap<string, CanvasElementDTO> = new Map(),
): NodeMetadata {
  const absolute = toAbsolute(element, index);
  return {
    id: element.id,
    shape: element.kind,
    x: absolute.x,
    y: absolute.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    parent: element.parentId ?? undefined,
    data: { element },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ports: CANVAS_PORTS as unknown as NonNullable<NodeMetadata["ports"]>,
  } satisfies NodeMetadata;
}

/** 元素 / 连线 DTO → X6 节点 / 边 metadata（供 `graph.fromJSON` 一次性建图）。 */
export function toX6Cells(document: CanvasDocument): CellMetadata[] {
  const index = new Map(document.elements.map((element) => [element.id, element]));
  const nodes: CellMetadata[] = document.elements.map((element) => nodeMetadataFor(element, index));
  const edges: CellMetadata[] = document.edges.map((edge) => {
    const visuals = edgeVisuals(edge);
    return {
      id: edge.id,
      shape: "edge",
      data: { edge },
      source: edge.source,
      target: edge.target,
      connector: visuals.connector as EdgeMetadata["connector"],
      ...(visuals.router ? { router: visuals.router as EdgeMetadata["router"] } : {}),
      attrs: visuals.attrs,
      ...(visuals.labels.length ? { labels: visuals.labels } : {}),
    } satisfies EdgeMetadata;
  });
  return [...nodes, ...edges];
}

/** 从现行 X6 图读回完整文档（id 零映射不变式）。 */
export function graphToDocument(graph: Graph): CanvasDocument {
  return {
    elements: graph.getNodes().map((node) => nodeToElement(node)),
    // X6 会在拖线开始时先把未完成 edge 加进 model；它不是文档数据，连接完成后再纳入快照。
    edges: graph
      .getEdges()
      .filter(
        (edge) =>
          edge.getSourceCellId() &&
          edge.getSourcePortId() &&
          edge.getTargetCellId() &&
          edge.getTargetPortId(),
      )
      .map((edge) => edgeToEdge(edge)),
  };
}

/** 新连线的初始 DTO（连线创建时 source/target 由 X6 connect 补齐）。 */
export function newEdgeDto(canvasId: string): CanvasEdgeDTO {
  return {
    id: crypto.randomUUID(),
    canvasId,
    source: { cell: "", port: "right" },
    target: { cell: "", port: "left" },
    router: null,
    connector: { ...DEFAULT_CANVAS_EDGE_CONNECTOR },
    attrs: structuredClone(DEFAULT_CANVAS_EDGE_ATTRS),
    label: null,
    createdAt: new Date().toISOString(),
  };
}

/** 连线 DTO → X6 Edge 实例（含默认样式 attrs/connector/marker），供 `connecting.createEdge` 用。 */
export function toX6Edge(edge: CanvasEdgeDTO): X6EdgeCtor {
  const visuals = edgeVisuals(edge);
  return new X6EdgeCtor({
    id: edge.id,
    shape: "edge",
    data: { edge },
    connector: visuals.connector as EdgeMetadata["connector"],
    ...(visuals.router ? { router: visuals.router as EdgeMetadata["router"] } : {}),
    attrs: visuals.attrs,
    ...(visuals.labels.length ? { labels: visuals.labels } : {}),
  });
}

/** 卡片内容 / 颜色：原地写 node data。react-shape Wrap 听 `change:data` 只重绘这一张。 */
export function applyElementUpdate(node: X6Node, element: CanvasElementDTO): void {
  node.replaceData({ element });
}

/**
 * 边配置 / 标签：原地写入 X6，不拆 cell。端点仍以 X6 store 为准。
 */
export function applyEdgePresentation(
  cell: X6Edge,
  patch: Pick<CanvasEdgeDTO, "attrs" | "label" | "router" | "connector">,
): void {
  const current = (cell.getData() as { edge?: CanvasEdgeDTO } | null)?.edge;
  if (!current) return;
  const next: CanvasEdgeDTO = { ...current, ...patch };
  const visuals = edgeVisuals(next);
  cell.replaceData({ edge: next });
  cell.setAttrs(visuals.attrs as EdgeMetadata["attrs"], { overwrite: true });
  cell.setConnector(visuals.connector as EdgeMetadata["connector"]);
  if (visuals.router) cell.setRouter(visuals.router as EdgeMetadata["router"]);
  else cell.removeRouter();
  cell.setLabels(visuals.labels);
}

/** X6 节点 → 元素 DTO（id/几何回读；组内子元素坐标为相对坐标）。 */
export function nodeToElement(node: X6Node): CanvasElementDTO {
  const data = (node.getData() as { element?: CanvasElementDTO } | null)?.element;
  const base = data ?? ({} as CanvasElementDTO);
  const position = node.getPosition({ relative: true });
  const size = node.size();
  const parent = node.getParent();
  return {
    ...base,
    id: node.id,
    x: position.x,
    y: position.y,
    width: size.width ?? base.width,
    height: size.height ?? base.height,
    zIndex: node.getZIndex() ?? base.zIndex,
    parentId: parent && parent.isNode() ? parent.id : null,
  };
}

/** X6 边 → 连线 DTO（source/target 补齐端口对应元素）。 */
export function edgeToEdge(edge: X6Edge): CanvasEdgeDTO {
  const data = (edge.getData() as { edge?: CanvasEdgeDTO } | null)?.edge;
  const base = data ?? ({} as CanvasEdgeDTO);
  // 读 store 的 terminal id（getSourceCell/getTargetCell 是构造时缓存的引用，
  // fromJSON/rebuild 重建后恒为 null，会造成“空端点”残边被保存链剔除）。
  const sourceCell = edge.getSourceCellId();
  const sourcePort = edge.getSourcePortId();
  const targetCell = edge.getTargetCellId();
  const targetPort = edge.getTargetPortId();
  const connector = edge.getConnector();
  if (!sourceCell || !sourcePort || !targetCell || !targetPort || !connector) {
    throw new Error(`Incomplete X6 edge: ${edge.id}`);
  }
  return {
    ...base,
    id: edge.id,
    source: {
      cell: sourceCell,
      port: sourcePort as CanvasEdgeDTO["source"]["port"],
    },
    target: {
      cell: targetCell,
      port: targetPort as CanvasEdgeDTO["target"]["port"],
    },
    router: (edge.getRouter() as CanvasEdgeRouter | null | undefined) ?? null,
    connector: connector as CanvasEdgeConnector,
    attrs: edge.getAttrs() as CanvasEdgeAttrs,
  };
}
