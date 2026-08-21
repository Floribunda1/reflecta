import type { Edge as X6Edge, EdgeMetadata } from "@antv/x6";
import type { Graph, Node as X6Node, NodeMetadata } from "@antv/x6";
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
      return { name: "straight" };
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

function lineAttrs(style: CanvasEdgeStyle | null) {
  const color = canvasPaintColor(style?.color) ?? "var(--muted-foreground)";
  const strokeWidth = style?.width === "thick" ? 4 : style?.width === "medium" ? 3 : 2;
  const strokeDasharray =
    style?.lineStyle === "dashed" ? "5 5" : style?.lineStyle === "dotted" ? "2 2" : undefined;
  const marker =
    style?.arrowhead === "block" ? { name: "block" as const } : { name: "classic" as const };
  const targetMarker =
    style?.arrowhead === "none" || style?.arrowhead === undefined
      ? null
      : { name: marker.name, width: 10, height: 8 };
  return {
    line: {
      stroke: color,
      strokeWidth,
      strokeDasharray: strokeDasharray ?? undefined,
      ...(targetMarker ? { targetMarker } : {}),
    },
  };
}

/** 元素 / 连线 DTO → X6 节点 / 边 metadata（供 `graph.fromJSON` 一次性建图）。 */
export function toX6Cells(document: CanvasDocument): CellMetadata[] {
  const index = new Map(document.elements.map((element) => [element.id, element]));
  const nodes: CellMetadata[] = document.elements.map((element) => {
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
  });
  const edges: CellMetadata[] = document.edges.map((edge) => {
    const style = edge.style ?? DEFAULT_CANVAS_EDGE_STYLE;
    return {
      id: edge.id,
      shape: "edge",
      data: { edge },
      source: { cell: edge.sourceElementId, port: "out" },
      target: { cell: edge.targetElementId, port: "in" },
      connector: connectorFor(style),
      ...(routerFor(style) ? { router: routerFor(style) } : {}),
      attrs: lineAttrs(style),
      ...(edge.label
        ? {
            labels: [
              {
                attrs: {
                  label: { text: edge.label, fill: "var(--foreground)", fontSize: 12 },
                },
              },
            ],
          }
        : {}),
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
  const source = edge.getSourceCell();
  const target = edge.getTargetCell();
  return {
    ...base,
    id: edge.id,
    sourceElementId: source && source.isNode() ? source.id : "",
    targetElementId: target && target.isNode() ? target.id : "",
  };
}
