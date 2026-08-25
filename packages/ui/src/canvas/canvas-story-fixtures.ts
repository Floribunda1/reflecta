import type {
  CanvasGraphChange,
  CanvasDocument,
  CanvasEdgeDTO,
  CanvasElementDTO,
} from "@reflecta/shared";
import { curveEdgePath, DEFAULT_CANVAS_EDGE_ATTRS, orthogonalEdgePath } from "./graph-document";
import type { CanvasLibraryItemView } from "./canvas-library-panel";
import type { DomainTreeNodeView } from "../capture/domain-tree";
import type { CanvasSearchIndexItem } from "./canvas-search-overlay";
import type {
  CanvasReferencedCanvasView,
  CanvasShapeData,
  CanvasUnderstandingRefView,
} from "./shape-context";

const TIME = "2026-08-19T10:00:00.000Z";

/**
 * Storybook 专用：给文档元素 / 连线的 id 重分配为全局唯一，并同步修复内部引用
 * （parentId / 边 source / target cell）。x6-react-shape 的 portal 用 node.id 当 React key
 * 且 portal 为单例——多张图若复用同一 fixture 的相同 id，卡片会撞 key 报 duplicate-key 警告。
 * 每张图挂载前过一遍，node id 全局唯一即免疫（生产 id 本就 randomUUID，无需此步）。
 */
export function withUniqueCanvasIds(doc: CanvasDocument): CanvasDocument {
  const idMap = new Map<string, string>();
  for (const element of doc.elements) idMap.set(element.id, crypto.randomUUID());
  const elements = doc.elements.map((element) => ({
    ...element,
    id: idMap.get(element.id) ?? element.id,
    parentId: element.parentId ? (idMap.get(element.parentId) ?? element.parentId) : null,
  }));
  const edges = doc.edges.map((edge) => ({
    ...edge,
    id: crypto.randomUUID(),
    source: { ...edge.source, cell: idMap.get(edge.source.cell) ?? edge.source.cell },
    target: { ...edge.target, cell: idMap.get(edge.target.cell) ?? edge.target.cell },
  }));
  return { elements, edges };
}

function baseElement(
  id: string,
  position: { x: number; y: number; width: number; height: number },
): Pick<
  CanvasElementDTO,
  | "id"
  | "canvasId"
  | "parentId"
  | "x"
  | "y"
  | "width"
  | "height"
  | "zIndex"
  | "createdAt"
  | "updatedAt"
> {
  return {
    id,
    canvasId: "canvas-irrigation",
    parentId: null,
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    zIndex: 1,
    createdAt: TIME,
    updatedAt: TIME,
  };
}

export function storyUnderstandingElement(
  id: string,
  understandingId: string,
  position: { x: number; y: number; width?: number; height?: number },
  color?: string,
): CanvasElementDTO {
  return {
    ...baseElement(id, {
      x: position.x,
      y: position.y,
      width: position.width ?? 260,
      height: position.height ?? 220,
    }),
    kind: "understanding",
    understandingId,
    canvasRefId: null,
    props: color ? { color } : {},
  };
}

export function storyTextElement(
  id: string,
  text: string,
  position: { x: number; y: number; width?: number; height?: number },
  color?: string,
): CanvasElementDTO {
  return {
    ...baseElement(id, {
      x: position.x,
      y: position.y,
      width: position.width ?? 220,
      height: position.height ?? 120,
    }),
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    props: color ? { text, color } : { text },
  };
}

export function storyGroupElement(
  id: string,
  label: string,
  position: { x: number; y: number; width: number; height: number },
  color?: string,
): CanvasElementDTO {
  return {
    ...baseElement(id, position),
    kind: "group",
    understandingId: null,
    canvasRefId: null,
    props: color ? { label, color } : { label },
  };
}

export function storyCanvasRefElement(
  id: string,
  canvasRefId: string,
  position: { x: number; y: number; width?: number; height?: number },
  color?: string,
): CanvasElementDTO {
  return {
    ...baseElement(id, {
      x: position.x,
      y: position.y,
      width: position.width ?? 240,
      height: position.height ?? 160,
    }),
    kind: "canvas_ref",
    understandingId: null,
    canvasRefId,
    props: color ? { color } : {},
  };
}

export function storyEdge(
  id: string,
  sourceElementId: string,
  targetElementId: string,
  label: string | null = null,
  attrs: CanvasEdgeDTO["attrs"] = structuredClone(DEFAULT_CANVAS_EDGE_ATTRS),
  pathConfig: Pick<CanvasEdgeDTO, "router" | "connector"> = curveEdgePath(),
  sourcePort: CanvasEdgeDTO["source"]["port"] = "right",
  targetPort: CanvasEdgeDTO["source"]["port"] = "left",
): CanvasEdgeDTO {
  return {
    id,
    canvasId: "canvas-irrigation",
    source: { cell: sourceElementId, port: sourcePort },
    target: { cell: targetElementId, port: targetPort },
    ...pathConfig,
    attrs,
    label,
    createdAt: TIME,
  };
}

export const irrigationUnderstanding: CanvasUnderstandingRefView = {
  id: "u-irrigation",
  title: "低温环境下的分区灌溉策略",
  body: [
    "不同种植槽根据 **基质含水率**、回水温度和主管压力获得独立灌溉窗口。",
    "",
    "- 夜间保持低压循环，避免结冰",
    "- 回水超过阈值时缩短该分区窗口",
    "",
    "详见 [[u:u-night-shift]]。",
  ].join("\n"),
  deleted: false,
};

export const unnamedUnderstanding: CanvasUnderstandingRefView = {
  id: "u-unnamed",
  title: null,
  body: "还没有标题的理解，用来观察卡片标题占位。",
  deleted: false,
};

export const deletedUnderstanding: CanvasUnderstandingRefView = {
  id: "u-deleted",
  title: "已删除的保温策略",
  body: "",
  deleted: true,
};

export const longUnderstanding: CanvasUnderstandingRefView = {
  id: "u-long",
  title: "这是一个非常长的理解标题，用来观察卡片顶栏在固定宽度下是否正确截断并且不撑破布局",
  body: [
    "这段正文包含 **强调**、[来源链接](https://example.com) 和多层列表，用来观察卡片内部滚动。",
    "",
    "1. 主管压力异常时的三种解释",
    "2. 夜班联调窗口与下一观察窗",
    "3. 传感器漂移复核步骤",
    "",
    "> 不要把应急阀门当成常规路径。",
    "",
    "```ts",
    "const window = zone.moisture < 0.22 ? 'open' : 'hold'",
    "```",
  ].join("\n"),
  deleted: false,
};

export const nestedPreviewDocument: CanvasDocument = {
  elements: [
    storyTextElement("nested-text", "夜班联调记录：回水温度稳定在 4°C。", {
      x: 24,
      y: 28,
      width: 180,
      height: 90,
    }),
  ],
  edges: [],
};

export const nightShiftCanvas: CanvasReferencedCanvasView = {
  id: "canvas-night-shift",
  title: "夜班联调画布",
  deleted: false,
  document: nestedPreviewDocument,
};

export const deletedCanvas: CanvasReferencedCanvasView = {
  id: "canvas-deleted",
  title: "已删除画布",
  deleted: true,
};

export const titleOnlyCanvas: CanvasReferencedCanvasView = {
  id: "canvas-title-only",
  title: "尚未加载预览的目标画布",
  deleted: false,
};

export const typicalUnderstandingRefs = new Map<string, CanvasUnderstandingRefView>([
  [irrigationUnderstanding.id, irrigationUnderstanding],
  [unnamedUnderstanding.id, unnamedUnderstanding],
  [deletedUnderstanding.id, deletedUnderstanding],
  [longUnderstanding.id, longUnderstanding],
]);

export const typicalReferencedCanvases = new Map<string, CanvasReferencedCanvasView>([
  [nightShiftCanvas.id, nightShiftCanvas],
  [deletedCanvas.id, deletedCanvas],
  [titleOnlyCanvas.id, titleOnlyCanvas],
]);

export const typicalShapeData: CanvasShapeData = {
  understandingRefs: typicalUnderstandingRefs,
  referencedCanvases: typicalReferencedCanvases,
};

export const typicalCanvasDocument: CanvasDocument = {
  elements: [
    storyUnderstandingElement("el-irrigation", irrigationUnderstanding.id, { x: 40, y: 40 }),
    storyTextElement("el-note", "主管压力在换班后回落到正常区间。", { x: 340, y: 40 }),
    storyGroupElement("el-group", "夜班观察", { x: 40, y: 300, width: 320, height: 200 }),
    {
      ...storyTextElement("el-grouped-note", "回水温度连续 3 个窗口低于阈值。", {
        x: 16,
        y: 24,
        width: 200,
        height: 100,
      }),
      parentId: "el-group",
    },
    storyCanvasRefElement("el-ref", nightShiftCanvas.id, { x: 400, y: 300 }),
  ],
  edges: [storyEdge("edge-depends", "el-irrigation", "el-note", "依赖")],
};

/**
 * Agent changes 归一化后的典型文档：分支、分组和汇总同时存在。
 *
 * 几何 = `packages/server/.../understanding-canvas/changes.ts` 中
 * `normalizeCanvasChanges`（ELK layered）对同一 changes 序列的真实输出，
 * 非手写——保证 storybook 预览的就是 agent 真正会生成的布局。
 * 若布局规则变更，先用该函数重新生成再更新此处，避免与真实输出漂移。
 */
/**
 * Agent 生成 canvas 的多类布局场景（输入 = agent changes 序列，非手写文档）。
 * storybook 与测试对每个输入跑真实 `normalizeCanvasChanges`（ELK）现场生成文档，
 * 几何永远与 server 一致——不再有静态几何快照。理解卡仅保留「显示文案映射」
 * （understandingId → title/body），这是展示数据，不是几何。
 */
export type AgentLayoutScenarioInput = {
  title: string;
  description: string;
  layout?: "auto" | "horizontal" | "vertical";
  changes: readonly CanvasGraphChange[];
  /** 理解卡显示文案（display，非几何）。 */
  understandingRefs?: ReadonlyMap<string, CanvasUnderstandingRefView>;
};

export const agentScenarioInputs: readonly AgentLayoutScenarioInput[] = [
  {
    title: "链式",
    description: "单条因果链路，水平对齐。",
    changes: [
      { op: "add_element", ref: "q", element: { kind: "text", text: "为什么极地温室耗能高？" } },
      { op: "add_element", ref: "a", element: { kind: "text", text: "回温管网保温不足" } },
      { op: "add_element", ref: "r", element: { kind: "text", text: "结论：补档分区保温" } },
      { op: "add_edge", ref: "e1", sourceRef: "q", targetRef: "a", label: "归因" },
      { op: "add_edge", ref: "e2", sourceRef: "a", targetRef: "r", label: "对策" },
    ],
  },
  {
    title: "分支汇聚",
    description: "一个源分两支，再汇聚到同一结论。",
    changes: [
      { op: "add_element", ref: "q", element: { kind: "text", text: "如何降低夜班灌溉风险？" } },
      { op: "add_element", ref: "a", element: { kind: "text", text: "方案 A：按温度动态缩短" } },
      { op: "add_element", ref: "b", element: { kind: "text", text: "方案 B：保持低压循环" } },
      { op: "add_element", ref: "d", element: { kind: "text", text: "结论：组合两种策略" } },
      { op: "add_edge", ref: "e1", sourceRef: "q", targetRef: "a", label: "评估" },
      { op: "add_edge", ref: "e2", sourceRef: "q", targetRef: "b", label: "评估" },
      { op: "add_edge", ref: "e3", sourceRef: "a", targetRef: "d", label: "支持" },
      { op: "add_edge", ref: "e4", sourceRef: "b", targetRef: "d", label: "支持" },
    ],
  },
  {
    title: "候选分组",
    description: "同源方案归入组，组内纵向排布，组后接结论。",
    changes: [
      { op: "add_element", ref: "q", element: { kind: "text", text: "如何降低夜班灌溉风险？" } },
      { op: "add_element", ref: "a", element: { kind: "text", text: "方案 A：按温度动态缩短" } },
      { op: "add_element", ref: "b", element: { kind: "text", text: "方案 B：保持低压循环" } },
      { op: "add_element", ref: "d", element: { kind: "text", text: "结论：组合两种策略" } },
      { op: "group", ref: "g", label: "候选方案", elementRefs: ["a", "b"] },
      { op: "add_edge", ref: "e1", sourceRef: "q", targetRef: "a", label: "评估" },
      { op: "add_edge", ref: "e2", sourceRef: "q", targetRef: "b", label: "评估" },
      { op: "add_edge", ref: "e3", sourceRef: "a", targetRef: "d", label: "支持" },
      { op: "add_edge", ref: "e4", sourceRef: "b", targetRef: "d", label: "支持" },
    ],
  },
  {
    title: "多源汇聚",
    description: "三路排查汇聚到一个结论，密度较高。",
    changes: [
      { op: "add_element", ref: "q", element: { kind: "text", text: "回灌偏差来源排查" } },
      { op: "add_element", ref: "a", element: { kind: "text", text: "主管压力波动" } },
      { op: "add_element", ref: "b", element: { kind: "text", text: "回水温度滞后" } },
      { op: "add_element", ref: "c", element: { kind: "text", text: "基质含水率漂移" } },
      { op: "add_element", ref: "d", element: { kind: "text", text: "结论：统一观察窗比对" } },
      { op: "add_edge", ref: "e1", sourceRef: "q", targetRef: "a", label: "排查" },
      { op: "add_edge", ref: "e2", sourceRef: "q", targetRef: "b", label: "排查" },
      { op: "add_edge", ref: "e3", sourceRef: "q", targetRef: "c", label: "排查" },
      { op: "add_edge", ref: "e4", sourceRef: "a", targetRef: "d", label: "汇" },
      { op: "add_edge", ref: "e5", sourceRef: "b", targetRef: "d", label: "汇" },
      { op: "add_edge", ref: "e6", sourceRef: "c", targetRef: "d", label: "汇" },
    ],
  },
  {
    title: "竖向流程",
    description: "自上而下链路，端口为 bottom→top。",
    layout: "vertical",
    changes: [
      { op: "add_element", ref: "q", element: { kind: "text", text: "顶层问题" } },
      { op: "add_element", ref: "a", element: { kind: "text", text: "中层归因" } },
      { op: "add_element", ref: "d", element: { kind: "text", text: "底策结论" } },
      { op: "add_edge", ref: "e1", sourceRef: "q", targetRef: "a", label: "归因" },
      { op: "add_edge", ref: "e2", sourceRef: "a", targetRef: "d", label: "对策" },
    ],
  },
  {
    title: "长文本",
    description: "节点携带长文本时，宽度与换行仍保持整洁。",
    changes: [
      {
        op: "add_element",
        ref: "q",
        element: {
          kind: "text",
          text: "长期回灌依赖观察窗，而非瞬时峰值；新管段试运营期需单独建档。",
        },
      },
      { op: "add_element", ref: "a", element: { kind: "text", text: "规则" } },
      { op: "add_edge", ref: "e1", sourceRef: "q", targetRef: "a", label: "约束" },
    ],
  },
  {
    title: "理解卡",
    description: "引入 understanding 卡（含标题与正文）参与自动布局的分支汇聚。",
    understandingRefs: new Map([
      ["u-irrigation", irrigationUnderstanding],
      ["u-long", longUnderstanding],
    ]),
    changes: [
      { op: "add_element", ref: "q", element: { kind: "text", text: "夜班灌溉风险如何拆解？" } },
      {
        op: "add_element",
        ref: "u1",
        element: { kind: "understanding", understandingId: "u-irrigation" },
      },
      {
        op: "add_element",
        ref: "u2",
        element: { kind: "understanding", understandingId: "u-long" },
      },
      {
        op: "add_element",
        ref: "d",
        element: { kind: "text", text: "结论：组合策略并设置回水阈值" },
      },
      { op: "add_edge", ref: "e1", sourceRef: "q", targetRef: "u1", label: "归因" },
      { op: "add_edge", ref: "e2", sourceRef: "q", targetRef: "u2", label: "归因" },
      { op: "add_edge", ref: "e3", sourceRef: "u1", targetRef: "d", label: "支持" },
      { op: "add_edge", ref: "e4", sourceRef: "u2", targetRef: "d", label: "支持" },
    ],
  },
];

function edgeGallery(
  rows: ReadonlyArray<{
    id: string;
    label: string;
    line?: Record<string, unknown>;
    pathConfig?: Pick<CanvasEdgeDTO, "router" | "connector">;
    edgeLabel?: string | null;
  }>,
): CanvasDocument {
  const elements = rows.flatMap((row, index) => [
    storyTextElement(`${row.id}-from`, row.label, {
      x: 40,
      y: 28 + index * 96,
      width: 168,
      height: 64,
    }),
    storyTextElement(`${row.id}-to`, "终点", {
      x: 400,
      y: 28 + index * 96,
      width: 88,
      height: 64,
    }),
  ]);
  const edges = rows.map((row) =>
    storyEdge(
      row.id,
      `${row.id}-from`,
      `${row.id}-to`,
      row.edgeLabel ?? row.label,
      {
        ...structuredClone(DEFAULT_CANVAS_EDGE_ATTRS),
        line: { ...DEFAULT_CANVAS_EDGE_ATTRS.line, ...row.line },
      },
      row.pathConfig,
    ),
  );
  return { elements, edges };
}

export const understandingCardsDocument: CanvasDocument = {
  elements: [
    storyUnderstandingElement("card-u-typical", irrigationUnderstanding.id, { x: 32, y: 32 }),
    storyUnderstandingElement("card-u-unnamed", unnamedUnderstanding.id, { x: 320, y: 32 }),
    storyUnderstandingElement("card-u-deleted", deletedUnderstanding.id, { x: 608, y: 32 }),
    storyUnderstandingElement("card-u-long", longUnderstanding.id, {
      x: 32,
      y: 280,
      width: 280,
      height: 260,
    }),
    storyUnderstandingElement(
      "card-u-paint",
      irrigationUnderstanding.id,
      { x: 340, y: 280 },
      "chart-2",
    ),
  ],
  edges: [],
};

export const textCardsDocument: CanvasDocument = {
  elements: [
    storyTextElement("card-t-preview", "主管压力在换班后回落到正常区间。", { x: 32, y: 32 }),
    storyTextElement("card-t-empty", "", { x: 280, y: 32 }),
    storyTextElement(
      "card-t-long",
      "回水温度、基质含水率和主管压力需要放在同一观察窗里比较，避免只看瞬时尖峰。".repeat(3),
      { x: 528, y: 32, width: 240, height: 160 },
    ),
    storyTextElement("card-t-paint", "着色文本卡", { x: 32, y: 220 }, "chart-3"),
  ],
  edges: [],
};

export const groupCardsDocument: CanvasDocument = {
  elements: [
    storyGroupElement("card-g-named", "夜班观察", { x: 40, y: 48, width: 280, height: 180 }),
    {
      ...storyTextElement("card-g-child", "回水温度连续 3 个窗口低于阈值。", {
        x: 16,
        y: 24,
        width: 200,
        height: 100,
      }),
      parentId: "card-g-named",
    },
    storyGroupElement("card-g-unnamed", "", { x: 360, y: 48, width: 220, height: 160 }),
    storyGroupElement(
      "card-g-long",
      "夜班联调、异常复验与下一观察窗的临时分组",
      { x: 620, y: 48, width: 260, height: 160 },
      "chart-1",
    ),
  ],
  edges: [],
};

export const canvasRefCardsDocument: CanvasDocument = {
  elements: [
    storyCanvasRefElement("card-r-preview", nightShiftCanvas.id, { x: 32, y: 32 }),
    storyCanvasRefElement("card-r-title", titleOnlyCanvas.id, { x: 300, y: 32 }),
    storyCanvasRefElement("card-r-deleted", deletedCanvas.id, { x: 568, y: 32 }),
    storyCanvasRefElement("card-r-paint", nightShiftCanvas.id, { x: 32, y: 220 }, "chart-4"),
  ],
  edges: [],
};

export const edgeRoutingDocument = edgeGallery([
  { id: "edge-curve", label: "曲线" },
  {
    id: "edge-straight",
    label: "直线",
    pathConfig: { router: null, connector: { name: "normal" } },
  },
  {
    id: "edge-orthogonal",
    label: "正交",
    pathConfig: orthogonalEdgePath("right", "left"),
  },
]);

export const edgeLineStyleDocument = edgeGallery([
  { id: "edge-solid", label: "实线" },
  { id: "edge-dashed", label: "虚线", line: { strokeDasharray: "5 5" } },
  { id: "edge-dotted", label: "点线", line: { strokeDasharray: "2 2" } },
]);

export const edgeWidthDocument = edgeGallery([
  { id: "edge-thin", label: "细", line: { strokeWidth: 2 } },
  { id: "edge-medium", label: "中", line: { strokeWidth: 3 } },
  { id: "edge-thick", label: "粗", line: { strokeWidth: 4 } },
]);

export const edgeColorDocument = edgeGallery([
  { id: "edge-color-none", label: "默认色" },
  { id: "edge-color-1", label: "chart-1", line: { stroke: "var(--chart-1)" } },
  { id: "edge-color-2", label: "chart-2", line: { stroke: "var(--chart-2)" } },
  { id: "edge-color-3", label: "chart-3", line: { stroke: "var(--chart-3)" } },
  { id: "edge-color-4", label: "chart-4", line: { stroke: "var(--chart-4)" } },
  { id: "edge-color-5", label: "chart-5", line: { stroke: "var(--chart-5)" } },
]);

export const edgeArrowheadDocument = edgeGallery([
  { id: "edge-arrow-classic", label: "箭头" },
  { id: "edge-arrow-block", label: "方块", line: { targetMarker: { name: "block" } } },
  { id: "edge-arrow-circle", label: "圆点", line: { targetMarker: { name: "circle" } } },
  { id: "edge-arrow-diamond", label: "菱形", line: { targetMarker: { name: "diamond" } } },
  { id: "edge-arrow-cross", label: "十字", line: { targetMarker: { name: "cross" } } },
  { id: "edge-arrow-ellipse", label: "椭圆", line: { targetMarker: { name: "ellipse" } } },
  { id: "edge-arrow-none", label: "无箭头", line: { targetMarker: null } },
]);

export const edgeLabelDocument = edgeGallery([
  { id: "edge-label-none", label: "无标签", edgeLabel: null },
  { id: "edge-label-short", label: "短标签", edgeLabel: "依赖" },
  {
    id: "edge-label-long",
    label: "长标签",
    edgeLabel: "夜班联调窗口与下一观察窗的依赖关系",
  },
]);

export const denseCanvasDocument: CanvasDocument = {
  elements: Array.from({ length: 18 }, (_, index) =>
    storyTextElement(
      `dense-${index}`,
      index % 4 === 0
        ? `第 ${index + 1} 张卡片使用较长正文来观察缩放下的可读性`
        : `观察窗 ${index + 1}`,
      {
        x: 40 + (index % 6) * 180,
        y: 40 + Math.floor(index / 6) * 140,
        width: 160,
        height: 100,
      },
    ),
  ),
  edges: Array.from({ length: 8 }, (_, index) =>
    storyEdge(`dense-edge-${index}`, `dense-${index}`, `dense-${index + 1}`, null),
  ),
};

export const typicalSearchIndex: CanvasSearchIndexItem[] = [
  { id: "el-irrigation", kind: "understanding", text: "低温环境下的分区灌溉策略" },
  { id: "el-note", kind: "text", text: "主管压力在换班后回落到正常区间。" },
  { id: "el-group", kind: "group", text: "夜班观察" },
  { id: "el-ref", kind: "canvas_ref", text: "夜班联调画布" },
  { id: "edge-depends", kind: "edge", text: "依赖" },
  {
    id: "el-long",
    kind: "understanding",
    text: "这是一个非常长的理解标题，用来观察搜索结果在固定宽度下是否正确截断并且不撑破布局",
  },
];

export const typicalLibraryDomains: DomainTreeNodeView[] = [
  {
    id: "engineering",
    name: "设施工程",
    children: [
      {
        id: "greenhouse",
        name: "极地温室",
        children: [{ id: "irrigation", name: "分区灌溉", children: [] }],
      },
    ],
  },
  { id: "product", name: "产品与用户价值", children: [] },
];

export const typicalLibraryItems: CanvasLibraryItemView[] = [
  { id: "u-irrigation", title: "低温环境下的分区灌溉策略" },
  { id: "u-night-shift", title: "夜班联调记录" },
  { id: "u-sensors", title: "传感器漂移复核" },
  { id: "u-unnamed", title: "未命名理解" },
  {
    id: "u-long",
    title: "这是一个非常长的理解标题，用来观察库列表面定宽度下的单行截断",
  },
];
