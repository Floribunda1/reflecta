import type { CanvasDocument, CanvasEdgeDTO, CanvasElementDTO } from "@reflecta/shared";
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
export const agentCanvasDocument: CanvasDocument = {
  elements: [
    storyTextElement("agent-question", "如何降低夜班灌溉风险？", {
      x: 12,
      y: 44,
    }),
    storyGroupElement("agent-options", "候选方案", {
      x: 337,
      y: 12,
      width: 244,
      height: 284,
    }),
    {
      ...storyTextElement("agent-risk", "方案 A：按温度动态缩短窗口", {
        x: 12,
        y: 152,
      }),
      parentId: "agent-options",
    },
    {
      ...storyTextElement("agent-cost", "方案 B：保持低压循环", {
        x: 12,
        y: 12,
      }),
      parentId: "agent-options",
    },
    storyTextElement("agent-decision", "结论：组合两种策略并设置回水阈值", {
      x: 686,
      y: 44,
    }),
  ],
  edges: [
    storyEdge("agent-edge-q-risk", "agent-question", "agent-risk", "评估"),
    storyEdge("agent-edge-q-cost", "agent-question", "agent-cost", "评估"),
    storyEdge("agent-edge-risk-dec", "agent-risk", "agent-decision", "支持"),
    storyEdge("agent-edge-cost-dec", "agent-cost", "agent-decision", "支持"),
  ],
};

/**
 * Agent 生成 canvas 的多类布局场景。几何一律来自真实 `normalizeCanvasChanges`
 * （ELK layered）输出，非手写——供 storybook 逐场景验收布局效果。
 * 若布局规则变更，先用该函数重新生成，再更新这里，避免与真实输出漂移。
 */
export type AgentLayoutScenario = {
  title: string;
  description: string;
  document: CanvasDocument;
  /** 渲染卡片所需的展示数据（理解卡全文等），缺省为空 shapeData。 */
  shapeData?: CanvasShapeData;
};

export const agentLayoutScenarios: readonly AgentLayoutScenario[] = [
  {
    title: "链式",
    description: "单条因果链路，水平对齐。",
    document: {
      elements: [
        storyTextElement("chain-q", "为什么极地温室耗能高？", { x: 12, y: 12 }),
        storyTextElement("chain-a", "回温管网保温不足", { x: 332, y: 12 }),
        storyTextElement("chain-r", "结论：补裆分区保温", { x: 652, y: 12 }),
      ],
      edges: [
        storyEdge("chain-e1", "chain-q", "chain-a", "归因"),
        storyEdge("chain-e2", "chain-a", "chain-r", "对策"),
      ],
    },
  },
  {
    title: "分支汇聚",
    description: "一个源分两支，再汇聚到同一结论。",
    document: {
      elements: [
        storyTextElement("bm-q", "如何降低夜班灌溉风险？", { x: 12, y: 32 }),
        storyTextElement("bm-a", "方案 A：按温度动态缩短", { x: 332, y: 192 }),
        storyTextElement("bm-b", "方案 B：保持低压循环", { x: 332, y: 12 }),
        storyTextElement("bm-d", "结论：组合两种策略", { x: 652, y: 32 }),
      ],
      edges: [
        storyEdge("bm-e1", "bm-q", "bm-a", "评估"),
        storyEdge("bm-e2", "bm-q", "bm-b", "评估"),
        storyEdge("bm-e3", "bm-a", "bm-d", "支持"),
        storyEdge("bm-e4", "bm-b", "bm-d", "支持"),
      ],
    },
  },
  {
    title: "候选分组",
    description: "同源方案归入组，组内纵向排布，组后接结论。",
    document: agentCanvasDocument,
  },
  {
    title: "多源汇聚",
    description: "三路排查汇聚到一个结论，密度较高。",
    document: {
      elements: [
        storyTextElement("dm-q", "回灌偏差来源排查", { x: 12, y: 42 }),
        storyTextElement("dm-a", "主管压力波动", { x: 332, y: 372 }),
        storyTextElement("dm-b", "回水温度滞后", { x: 332, y: 192 }),
        storyTextElement("dm-c", "基质含水率漂移", { x: 332, y: 12 }),
        storyTextElement("dm-d", "结论：统一观察窗比对", { x: 652, y: 192 }),
      ],
      edges: [
        storyEdge("dm-e1", "dm-q", "dm-a", "排查"),
        storyEdge("dm-e2", "dm-q", "dm-b", "排查"),
        storyEdge("dm-e3", "dm-q", "dm-c", "排查"),
        storyEdge("dm-e4", "dm-a", "dm-d", "汇"),
        storyEdge("dm-e5", "dm-b", "dm-d", "汇"),
        storyEdge("dm-e6", "dm-c", "dm-d", "汇"),
      ],
    },
  },
  {
    title: "竖向流程",
    description: "自上而下链路，端口为 bottom→top。",
    document: {
      elements: [
        storyTextElement("vt-q", "顶层问题", { x: 12, y: 12 }),
        storyTextElement("vt-a", "中层归因", { x: 12, y: 232 }),
        storyTextElement("vt-d", "底策结论", { x: 12, y: 452 }),
      ],
      edges: [
        storyEdge("vt-e1", "vt-q", "vt-a", "归因", undefined, undefined, "bottom", "top"),
        storyEdge("vt-e2", "vt-a", "vt-d", "对策", undefined, undefined, "bottom", "top"),
      ],
    },
  },
  {
    title: "长文本",
    description: "节点携带长文本时，宽度与换行仍保持整洁。",
    document: {
      elements: [
        storyTextElement("lt-q", "长期回灌依赖观察窗，而非瞬时峰值；新管段试运营期需单独建档。", {
          x: 12,
          y: 12,
        }),
        storyTextElement("lt-a", "规则", { x: 332, y: 12 }),
      ],
      edges: [storyEdge("lt-e1", "lt-q", "lt-a", "约束")],
    },
  },
  {
    title: "理解卡",
    description: "引入 understanding 卡（260×220，含标题与正文）参与自动布局的分支汇聚。",
    shapeData: {
      understandingRefs: new Map([
        ["u-irrigation", irrigationUnderstanding],
        ["u-long", longUnderstanding],
      ]),
      referencedCanvases: new Map(),
    },
    document: {
      elements: [
        storyTextElement("uc-q", "夜班灌溉风险如何拆解？", { x: 12, y: 82 }),
        storyUnderstandingElement("uc-u1", "u-irrigation", { x: 332, y: 292 }),
        storyUnderstandingElement("uc-u2", "u-long", { x: 332, y: 12 }),
        storyTextElement("uc-d", "结论：组合策略并设置回水阈值", { x: 692, y: 82 }),
      ],
      edges: [
        storyEdge("uc-e1", "uc-q", "uc-u1", "归因"),
        storyEdge("uc-e2", "uc-q", "uc-u2", "归因"),
        storyEdge("uc-e3", "uc-u1", "uc-d", "支持"),
        storyEdge("uc-e4", "uc-u2", "uc-d", "支持"),
      ],
    },
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
