import type { Edge as X6Edge, EdgeMetadata } from "@antv/x6";
import {
  Edge as X6EdgeCtor,
  Graph as X6Graph,
  Path,
  type Graph,
  type Node as X6Node,
  type NodeMetadata,
} from "@antv/x6";
import type {
  CanvasDocument,
  CanvasEdgeAttrs,
  CanvasEdgeConnector,
  CanvasEdgeDTO,
  CanvasEdgePortId,
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

export const DEFAULT_CANVAS_EDGE_CONNECTOR: CanvasEdgeConnector = {
  name: "reflecta-curve",
};
export const DEFAULT_CANVAS_EDGE_ATTRS: CanvasEdgeAttrs = {
  line: {
    stroke: "var(--muted-foreground)",
    strokeWidth: 2,
    targetMarker: { name: "classic", width: 10, height: 8 },
  },
  lines: { connection: true, strokeLinejoin: "round" },
  wrap: { strokeWidth: 10 },
};

/**
 * 边 label 用实色线色 pill（圆角矩形）挡线 + 按线色明暗自适应文字色。
 * 背景色跟随的是“线色”而不是“背后 group 底色”——所以换色 / detach / 挪动 / 嵌套
 * 全都无需同步：颜色来源唯一且确定（line.stroke），改线色由 applyEdgePresentation
 * 重算 label attrs 天然跟随，零组件 / 零同步。
 * X6 defaultLabel markup 的 body 设 fill + rx 成紧凑 tag，并用 ref* 属性补内边距；
 * label 文字用 contrastTextColor 选高对比色。
 */
function edgeLabelItems(label: string | null, color: string) {
  const tag = {
    fill: color,
    stroke: "none",
    rx: 4,
    refX: -6,
    refY: -3,
    refWidth: 12,
    refHeight: 6,
  } as const;
  return label
    ? [
        {
          attrs: {
            body: tag,
            label: {
              text: label,
              fill: contrastTextColor(color),
              fontSize: 11,
              fontWeight: 500,
            },
          },
        },
      ]
    : [];
}

function edgeLabels(edge: CanvasEdgeDTO, attrs: CanvasEdgeAttrs) {
  const stroke = attrs.line?.stroke;
  const color = typeof stroke === "string" ? stroke : "var(--muted-foreground)";
  return edgeLabelItems(edge.label, color);
}

/** chart token（存 `var(--chart-N)`）→ 真实 hex，用于明暗判断。 */
const CHART_TOKEN_HEX: Record<string, string> = {
  "var(--chart-1)": "#0d9488",
  "var(--chart-2)": "#3c6fb4",
  "var(--chart-3)": "#7c5c9e",
  "var(--chart-4)": "#ab4642",
  "var(--chart-5)": "#b58900",
};

function parseHex(color: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const hex = m[1];
  if (hex.length === 3)
    return `#${hex
      .split("")
      .map((c) => c + c)
      .join("")}`;
  return `#${hex}`;
}

/** 实色 tag 上用高对比文字色：CSS 灰色 token 用主题背景色自适应明暗。 */
function contrastTextColor(color: string): string {
  if (color === "var(--muted-foreground)") return "var(--background)";
  const hex = CHART_TOKEN_HEX[color] ?? parseHex(color);
  if (!hex) return "var(--background)";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.5 ? "var(--foreground)" : "#fff";
}

function edgeVisuals(edge: CanvasEdgeDTO) {
  // 草稿 / 外源 document 的边可能缺 attrs（Type.Unknown() 透传），缺省合并默认样式，
  // 避免 edgeLabels 在 edge.attrs.line 上崩溃拖垮整幅渲染。
  const attrs = edge.attrs
    ? { ...DEFAULT_CANVAS_EDGE_ATTRS, ...edge.attrs }
    : DEFAULT_CANVAS_EDGE_ATTRS;
  return {
    router: edge.router,
    connector: edge.connector ?? DEFAULT_CANVAS_EDGE_CONNECTOR,
    attrs,
    labels: edgeLabels(edge, attrs),
  };
}

/** 单个元素 → X6 节点 metadata（相对→绝对坐标；供 fromJSON 与 Dnd 拖拽 phantom 复用）。 */
export function nodeMetadataFor(
  element: CanvasElementDTO,
  index: ReadonlyMap<string, CanvasElementDTO> = new Map(),
): NodeMetadata {
  const absolute = toAbsolute(element, index);
  // paint 色挂到节点根元素的 CSS 变量：端口圆是 SVG attribute，fill="var(...)" 不解析
  // （palette token / hex 都写不进 attribute），由 globals.css 的 .x6-port-body 读变量着色。
  const paint = element.props.color ? tokenPaintColor(element.props.color) : undefined;
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
    attrs: paint
      ? ({
          root: {
            style: { "--canvas-node-paint": paint },
          },
        } as unknown as NonNullable<NodeMetadata["attrs"]>)
      : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ports: CANVAS_PORTS as unknown as NonNullable<NodeMetadata["ports"]>,
  } satisfies NodeMetadata;
}

/** 色板 token（chart-1..5）→ CSS 变量引用；遗留 hex 原样返回。 */
function tokenPaintColor(color: string): string {
  return /^chart-[1-5]$/.test(color) ? `var(--${color})` : color;
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
    ...curveEdgePath(),
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
  const prev = (node.getData() as { element?: CanvasElementDTO } | null | undefined)?.element;
  node.replaceData({ element });
  // 颜色原地变换时同步根元素 CSS 变量 → 端口圆色；颜色没变不碰 attrs。
  // 未设色时写 var(--ring)（与 CSS 的 var(--canvas-node-paint, var(--ring))
  // fallback 同色）而不是删除变量键——removeAttrByPath 会置 dirty 强制
  // 整棵子树的 async 重建，group+children 在虚拟渲染下会挂。永远走 set。
  if (prev?.props.color === element.props.color) return;
  const paint = element.props.color ? tokenPaintColor(element.props.color) : "var(--ring)";
  node.attr("root/style/--canvas-node-paint", paint);
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

export function curveEdgePath(): Pick<CanvasEdgeDTO, "router" | "connector"> {
  return {
    router: { name: "reflecta-curve" },
    connector: { ...DEFAULT_CANVAS_EDGE_CONNECTOR },
  };
}

export function orthogonalEdgePath(
  sourcePort: CanvasEdgePortId,
  targetPort: CanvasEdgePortId,
): Pick<CanvasEdgeDTO, "router" | "connector"> {
  return {
    router: {
      name: "manhattan",
      args: {
        startDirections: [sourcePort],
        endDirections: [targetPort],
        padding: 16,
      },
    },
    connector: { name: "rounded", args: { radius: 8 } },
  };
}

const PORT_VECTORS: Record<CanvasEdgePortId, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const OPPOSITE_PORT: Record<CanvasEdgePortId, CanvasEdgePortId> = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
};

export function curvePathData(
  source: { x: number; y: number },
  target: { x: number; y: number },
  sourcePort: CanvasEdgePortId,
  targetPort: CanvasEdgePortId,
  routePoints = curveTerminalRoutePoints(source, target, sourcePort, targetPort),
): string {
  const sourceVector = PORT_VECTORS[sourcePort];
  const targetVector = PORT_VECTORS[targetPort];
  const [sourceStub, targetStub] = routePoints;
  const control = Math.min(
    160,
    Math.max(48, Math.hypot(targetStub.x - sourceStub.x, targetStub.y - sourceStub.y) / 2),
  );
  const path = new Path();
  path.appendSegment(Path.createSegment("M", source));
  path.appendSegment(Path.createSegment("L", sourceStub));
  path.appendSegment(
    Path.createSegment(
      "C",
      sourceStub.x + sourceVector.x * control,
      sourceStub.y + sourceVector.y * control,
      targetStub.x + targetVector.x * control,
      targetStub.y + targetVector.y * control,
      targetStub.x,
      targetStub.y,
    ),
  );
  path.appendSegment(Path.createSegment("L", target));
  return path.serialize();
}

export function curveTerminalRoutePoints(
  source: { x: number; y: number },
  target: { x: number; y: number },
  sourcePort: CanvasEdgePortId,
  targetPort: CanvasEdgePortId,
): [{ x: number; y: number }, { x: number; y: number }] {
  const stub = 16;
  const sourceVector = PORT_VECTORS[sourcePort];
  const targetVector = PORT_VECTORS[targetPort];
  return [
    { x: source.x + sourceVector.x * stub, y: source.y + sourceVector.y * stub },
    { x: target.x + targetVector.x * stub, y: target.y + targetVector.y * stub },
  ];
}

let edgeRegistriesReady = false;
export function ensureCanvasConnectors(): void {
  if (edgeRegistriesReady) return;
  edgeRegistriesReady = true;
  X6Graph.registerConnector(
    "reflecta-curve",
    function (source, target, routePoints, options: { raw?: boolean }) {
      const sourcePort = this.cell.getSourcePortId() as CanvasEdgePortId | null;
      const targetPort = this.cell.getTargetPortId() as CanvasEdgePortId | null;
      const resolvedSourcePort = sourcePort ?? (targetPort ? OPPOSITE_PORT[targetPort] : "right");
      const path = curvePathData(
        source,
        target,
        resolvedSourcePort,
        targetPort ?? OPPOSITE_PORT[resolvedSourcePort],
        routePoints as [{ x: number; y: number }, { x: number; y: number }],
      );
      return options.raw ? Path.parse(path) : path;
    },
    true,
  );
  X6Graph.registerRouter(
    "reflecta-curve",
    function () {
      const sourcePort = this.cell.getSourcePortId() as CanvasEdgePortId | null;
      const targetPort = this.cell.getTargetPortId() as CanvasEdgePortId | null;
      const resolvedSourcePort = sourcePort ?? (targetPort ? OPPOSITE_PORT[targetPort] : "right");
      return curveTerminalRoutePoints(
        this.sourceAnchor,
        this.targetAnchor,
        resolvedSourcePort,
        targetPort ?? OPPOSITE_PORT[resolvedSourcePort],
      );
    },
    true,
  );
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
