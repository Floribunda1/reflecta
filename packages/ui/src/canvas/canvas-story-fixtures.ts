import type { CanvasDocument, CanvasEdgeDTO, CanvasElementDTO } from "./document";
import type { CanvasLibraryDomainOption, CanvasLibraryItemView } from "./canvas-library-panel";
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
  style: CanvasEdgeDTO["style"] = null,
): CanvasEdgeDTO {
  return {
    id,
    canvasId: "canvas-irrigation",
    sourceElementId,
    targetElementId,
    label,
    style,
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
  edges: [
    storyEdge("edge-depends", "el-irrigation", "el-note", "依赖", {
      routing: "curve",
      lineStyle: "solid",
      width: "thin",
      arrowhead: "classic",
    }),
  ],
};

export const edgeStyleDocument: CanvasDocument = {
  elements: [
    storyTextElement("edge-a", "A", { x: 40, y: 80, width: 120, height: 72 }),
    storyTextElement("edge-b", "B", { x: 280, y: 40, width: 120, height: 72 }),
    storyTextElement("edge-c", "C", { x: 280, y: 160, width: 120, height: 72 }),
  ],
  edges: [
    storyEdge("edge-curve", "edge-a", "edge-b", "曲线", {
      routing: "curve",
      lineStyle: "solid",
      width: "thin",
      arrowhead: "classic",
    }),
    storyEdge("edge-orth", "edge-a", "edge-c", "正交虚线", {
      routing: "orthogonal",
      lineStyle: "dashed",
      width: "medium",
      color: "chart-2",
      arrowhead: "block",
    }),
  ],
};

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

export const typicalLibraryDomains: CanvasLibraryDomainOption[] = [
  { id: "engineering", name: "设施工程", depth: 0 },
  { id: "greenhouse", name: "极地温室", depth: 1 },
  { id: "irrigation", name: "分区灌溉", depth: 2 },
  { id: "product", name: "产品与用户价值", depth: 0 },
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
