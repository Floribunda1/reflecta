import type { Edge as X6Edge, EdgeMetadata } from "@antv/x6";
import { Edge as X6EdgeCtor, type Graph, type Node as X6Node, type NodeMetadata } from "@antv/x6";
import type { CanvasDocument, CanvasEdgeDTO, CanvasEdgeStyle, CanvasElementDTO } from "./document";
import { DEFAULT_CANVAS_EDGE_STYLE } from "./document";
import { canvasPaintColor } from "./color-swatches";
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

function connectorFor(style: CanvasEdgeStyle | null): EdgeMetadata["connector"] {
  switch (style?.routing) {
    case "straight":
      // X6 3.x 内建 connector 无 straight：normal + 无 router 中间点 = 直线段
      return { name: "normal" };
    case "orthogonal":
      return { name: "rounded", args: { radius: 8 } };
    case "curve":
    default:
      return { name: "smooth" };
  }
}

function routerFor(style: CanvasEdgeStyle | null): EdgeMetadata["router"] {
  return style?.routing === "orthogonal" ? { name: "orth" } : undefined;
}

function edgeLabelItems(label: string | null) {
  return label
    ? [
        {
          attrs: {
            body: { fill: "var(--background)", stroke: "none" },
            label: { text: label, fill: "var(--foreground)", fontSize: 12 },
          },
        },
      ]
    : [];
}

function edgeVisuals(edge: CanvasEdgeDTO) {
  const style = edge.style ?? DEFAULT_CANVAS_EDGE_STYLE;
  return {
    connector: connectorFor(style),
    router: routerFor(style),
    attrs: edgeAttrs(style),
    labels: edgeLabelItems(edge.label),
  };
}

/**
 * 边 attrs：业务样式（lineAttrs）合并回 X6 默认 edge 所需的结构。
 * 必须保留 lines.connection:true —— X6 靠它把路径 d 写到两条路径（wrap 命中层 + line）；
 * 直接传 lineAttrs 会把默认 attrs 整个替换掉，边不渲染也不可点。
 */
export function edgeAttrs(style: CanvasEdgeStyle | null) {
  return {
    ...lineAttrs(style),
    lines: { connection: true, strokeLinejoin: "round" },
    wrap: { strokeWidth: 10 },
  };
}

export function lineAttrs(style: CanvasEdgeStyle | null) {
  const color = canvasPaintColor(style?.color) ?? "var(--muted-foreground)";
  const strokeWidth = style?.width === "thick" ? 4 : style?.width === "medium" ? 3 : 2;
  const strokeDasharray =
    style?.lineStyle === "dashed" ? "5 5" : style?.lineStyle === "dotted" ? "2 2" : undefined;
  // arrowhead 即 X6 marker 名（契约与 X6 一一对应，不再映射）
  const markerName = style?.arrowhead ?? "classic";
  const targetMarker = markerName === "none" ? null : { name: markerName, width: 10, height: 8 };
  return {
    line: {
      stroke: color,
      strokeWidth,
      strokeDasharray: strokeDasharray ?? undefined,
      // 显式写 null：X6 边 shape 自带默认 targetMarker，省略会回落成默认箭头（“无”失效）
      targetMarker,
    },
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
      source: { cell: edge.sourceElementId, port: "out" },
      target: { cell: edge.targetElementId, port: "in" },
      connector: visuals.connector,
      ...(visuals.router ? { router: visuals.router } : {}),
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
    edges: graph.getEdges().map((edge) => edgeToEdge(edge)),
  };
}

/** 新连线的初始 DTO（连线创建时 source/target 由 X6 connect 补齐）。 */
export function newEdgeDto(canvasId: string): CanvasEdgeDTO {
  return {
    id: crypto.randomUUID(),
    canvasId,
    sourceElementId: "",
    targetElementId: "",
    label: null,
    style: { ...DEFAULT_CANVAS_EDGE_STYLE },
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
    connector: visuals.connector,
    ...(visuals.router ? { router: visuals.router } : {}),
    attrs: visuals.attrs,
    ...(visuals.labels.length ? { labels: visuals.labels } : {}),
  });
}

/** 卡片内容 / 颜色：原地写 node data。react-shape Wrap 听 `change:data` 只重绘这一张。 */
export function applyElementUpdate(node: X6Node, element: CanvasElementDTO): void {
  node.replaceData({ element });
}

/**
 * 边样式 / 标签：原地改 attrs，不拆 cell。端点仍以 X6 store 为准，只合并 style / label。
 * `overwrite` 清掉上一档线型的 dasharray / marker，避免 merge 残留。
 */
export function applyEdgePresentation(
  cell: X6Edge,
  patch: Pick<CanvasEdgeDTO, "style" | "label">,
): void {
  const current = (cell.getData() as { edge?: CanvasEdgeDTO } | null)?.edge;
  if (!current) return;
  const next: CanvasEdgeDTO = { ...current, style: patch.style, label: patch.label };
  const visuals = edgeVisuals(next);
  cell.replaceData({ edge: next });
  cell.setAttrs(visuals.attrs, { overwrite: true });
  if (visuals.connector) cell.setConnector(visuals.connector);
  if (visuals.router) cell.setRouter(visuals.router);
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
  const sourceId = edge.getSourceCellId() ?? "";
  const targetId = edge.getTargetCellId() ?? "";
  return {
    ...base,
    id: edge.id,
    sourceElementId: sourceId,
    targetElementId: targetId,
  };
}
