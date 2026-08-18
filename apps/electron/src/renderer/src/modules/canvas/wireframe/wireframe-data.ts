import { BookOpen, FileText, FolderTree, PanelsTopLeft, User } from "lucide-react";
import type { ContextDTO } from "@shared/context";
import type { CanvasDTO, CanvasDetailDTO, CanvasElementDTO, CanvasEdgeDTO } from "@reflecta/server";
import type { UnderstandingCardView } from "@reflecta/ui/capture";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

/**
 * 画布模块线框（wireframe）演示数据。
 *
 * 用途：样式讨论用的纯前端 mock —— 数据不与后端联通，仅用于把画布页面的
 * 信息架构 / 视觉形态跑起来（rail 画布列表、无限画布、右侧单面板）。
 * 数据契约与 `@reflecta/server` 的 Canvas DTO 同构，后续接真实后端时类型可直接复用。
 */

export const WIREFRAME_WORLD = { width: 3200, height: 2400 } as const;

// ─── 领域 / 理解（复用真实 UnderstandingCard 的 view 契约） ──────────────────

export const WIREFRAME_DOMAINS = [
  { id: "d-greenhouse", name: "温室工程" },
  { id: "d-work", name: "工作" },
  { id: "d-self", name: "三观" },
] as const;

/** 引用计数：理解正文里 [[u:...]] 的条数（模拟值） */
const MOCK_MENTIONS: Record<string, number> = {
  "u-irrigation": 5,
  "u-moisture": 3,
  "u-return-water": 2,
  "u-iteration": 2,
  "u-existence": 1,
};

export const WIREFRAME_UNDERSTANDINGS: Record<string, UnderstandingCardView> = {
  "u-irrigation": {
    id: "u-irrigation",
    title: "低温环境下的分区灌溉策略",
    body: "不同种植槽根据 **基质含水率**、回水温度和主管压力获得独立灌溉窗口。\n\n- 先开旁通阀，再依次开各支路\n- 峰值数据不作为最终结论\n- 夜间回水温度低于 12℃ 时转入人工复核",
    updatedLabel: "12 分钟前",
    contextCount: 3,
    mentionCount: MOCK_MENTIONS["u-irrigation"],
    domainNames: ["温室工程", "工作"],
  },
  "u-moisture": {
    id: "u-moisture",
    title: "基质含水率与蒸腾速率的关系",
    body: "基质含水率在 45%–65% 区间内，**蒸腾速率随含水率近似线性上升**；低于 40% 后蒸腾骤降，作物进入自我保水状态。",
    updatedLabel: "2 小时前",
    contextCount: 1,
    mentionCount: MOCK_MENTIONS["u-moisture"],
    domainNames: ["温室工程"],
  },
  "u-return-water": {
    id: "u-return-water",
    title: "回水温度是滞后信号",
    body: "回水温度反映的是**上一轮灌溉的结果**，不是当下基质的状态。\n\n把它当实时信号用会踩两个坑：\n1. 迟到——管道热容缓冲了变化\n2. 混淆——多支路回水混在一起",
    updatedLabel: "昨天",
    contextCount: 0,
    mentionCount: MOCK_MENTIONS["u-return-water"],
    domainNames: ["温室工程", "工作"],
  },
  "u-iteration": {
    id: "u-iteration",
    title: "心智模型的迭代三段式",
    body: "对任何一个领域的理解，迭代遵循三个阶段：\n\n1. 先看见现象\n2. 再抽出机制\n3. 最后压成可迁移的判断",
    updatedLabel: "4 天前",
    contextCount: 1,
    mentionCount: MOCK_MENTIONS["u-iteration"],
    domainNames: ["三观"],
  },
  "u-existence": {
    id: "u-existence",
    title: "存在不需要被证明",
    body: "存在先于本质。我的存在本身不由任何人决定。",
    updatedLabel: "5 天前",
    contextCount: 0,
    mentionCount: MOCK_MENTIONS["u-existence"],
    domainNames: ["三观"],
  },
};

/** 详情模式用的上下文 mock（契约对齐 ContextDTO） */
export const WIREFRAME_CONTEXTS: Record<string, ContextDTO[]> = {
  "u-irrigation": [
    {
      id: "c-exp",
      understandingId: "u-irrigation",
      medium: "experience",
      title: "2025 秋冬两轮灌溉复盘",
      content: "第一轮按统一时长浇，靠北的槽出现积水；第二轮按分区窗口浇，整体蒸腾量反而更高。",
      createdAt: "2026-02-10T09:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "c-doc",
      understandingId: "u-irrigation",
      medium: "article",
      title: "温室分区灌溉控制规范（草稿）",
      content: "支路调度需满足：旁通阀先于支路开启；支路间间隔 ≥ 90s；异常重试不超过 3 次。",
      createdAt: "2026-02-11T09:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "c-data",
      understandingId: "u-irrigation",
      medium: "ai",
      title: "AI 对话沉淀：调度窗口怎么设",
      content: "建议按「基质含水率回落速度」动态设窗口，而不是固定时刻表。",
      createdAt: "2026-02-12T09:00:00.000Z",
      deletedAt: null,
    },
  ],
  "u-moisture": [
    {
      id: "c-moist",
      understandingId: "u-moisture",
      medium: "experience",
      title: "含水率探针校准记录",
      content: "两套探针互为校准：电容法漂移快，张力法响应慢，合并读数后曲线可用。",
      createdAt: "2026-02-08T09:00:00.000Z",
      deletedAt: null,
    },
  ],
  "u-iteration": [
    {
      id: "c-iter",
      understandingId: "u-iteration",
      medium: "book",
      title: "《模型思维》笔记",
      content: "最有效的模型往往是在现象反复出现之后才被注意到。",
      createdAt: "2026-01-20T09:00:00.000Z",
      deletedAt: null,
    },
  ],
};

// ─── 画布 ────────────────────────────────────────────────────────────────────

function canvasDto(
  id: string,
  title: string,
  description: string,
  updatedHoursAgo: number,
): CanvasDTO {
  const createdAt = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const updatedAt = new Date(Date.now() - updatedHoursAgo * 3_600_000).toISOString();
  return { id, title, description, viewport: null, createdAt, updatedAt };
}

export const WIREFRAME_CANVASES: CanvasDTO[] = [
  canvasDto("c-greenhouse", "温室工程整体方案", "灌溉回路与执行层结构", 3),
  canvasDto("c-loop", "灌溉控制回路细节", "信号链路与回水判断", 14),
  canvasDto("c-knowledge", "个人知识体系", "三观与工作方法", 30),
  canvasDto("c-settle", "对话沉淀演示", "从对话落地的画布（U4 场景）", 52),
];

const T = (ms = 5) => new Date(Date.now() - ms * 3_600_000).toISOString();

/** 元素 DTO 工厂：按 kind 拼装判别联合（与 server CanvasElementDTO 一致） */
type ElOptions = {
  understandingId?: string;
  canvasRefId?: string;
  props?: Record<string, unknown>;
};

function el(
  id: string,
  canvasId: string,
  kind: CanvasElementDTO["kind"],
  rect: { x: number; y: number; width: number; height: number },
  options: ElOptions = {},
  parentId: string | null = null,
  zIndex = 0,
): CanvasElementDTO {
  const base = {
    id,
    canvasId,
    parentId,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    zIndex,
    createdAt: T(8),
    updatedAt: T(2),
  };
  switch (kind) {
    case "understanding":
      return {
        ...base,
        kind,
        understandingId: options.understandingId ?? null,
        canvasRefId: null,
        props: {},
      };
    case "canvas_ref":
      return {
        ...base,
        kind,
        canvasRefId: options.canvasRefId ?? null,
        understandingId: null,
        props: {},
      };
    case "text":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { text: String(options.props?.text ?? "") },
      };
    case "shape":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { shapeType: options.props?.shapeType === "circle" ? "circle" : "rect" },
      };
    case "group":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { label: String(options.props?.label ?? "") },
      };
  }
}

function edge(
  id: string,
  canvasId: string,
  sourceElementId: string,
  targetElementId: string,
  label: string | null,
  style: CanvasEdgeDTO["style"] = null,
): CanvasEdgeDTO {
  return { id, canvasId, sourceElementId, targetElementId, label, style, createdAt: T(1) };
}

/** 「温室工程整体方案」：链路 + 执行层分组 + 画布引用 + 文本/形状，覆盖全部元素种类 */
const greenhouseElements: CanvasElementDTO[] = [
  el(
    "gh-u1",
    "c-greenhouse",
    "understanding",
    { x: 260, y: 230, width: 300, height: 184 },
    {
      understandingId: "u-irrigation",
    },
  ),
  el(
    "gh-u2",
    "c-greenhouse",
    "understanding",
    { x: 940, y: 200, width: 300, height: 184 },
    {
      understandingId: "u-moisture",
    },
  ),
  el(
    "gh-t1",
    "c-greenhouse",
    "text",
    { x: 660, y: 520, width: 240, height: 56 },
    {
      props: { text: "午后喷淋会造成回水浪费" },
    },
  ),
  el(
    "gh-s1",
    "c-greenhouse",
    "shape",
    { x: 240, y: 780, width: 150, height: 84 },
    {
      props: { shapeType: "rect" },
    },
  ),
  el(
    "gh-s2",
    "c-greenhouse",
    "shape",
    { x: 470, y: 788, width: 80, height: 80 },
    {
      props: { shapeType: "circle" },
    },
  ),
  // 执行层分组（group 内含子元素；子元素坐标为画布绝对坐标，渲染时相对组内偏移）
  el(
    "gh-g1",
    "c-greenhouse",
    "group",
    { x: 240, y: 1060, width: 660, height: 320 },
    {
      props: { label: "执行层" },
    },
  ),
  el(
    "gh-c1",
    "c-greenhouse",
    "shape",
    { x: 320, y: 1140, width: 130, height: 76 },
    {
      props: { shapeType: "rect" },
    },
    "gh-g1",
  ),
  el(
    "gh-c2",
    "c-greenhouse",
    "text",
    { x: 490, y: 1140, width: 220, height: 56 },
    {
      props: { text: "先开旁通，再依次开支路" },
    },
    "gh-g1",
  ),
  el(
    "gh-c3",
    "c-greenhouse",
    "shape",
    { x: 320, y: 1260, width: 130, height: 76 },
    {
      props: { shapeType: "rect" },
    },
    "gh-g1",
  ),
  el(
    "gh-c4",
    "c-greenhouse",
    "shape",
    { x: 500, y: 1260, width: 130, height: 76 },
    {
      props: { shapeType: "rect" },
    },
    "gh-g1",
  ),
  el(
    "gh-ref",
    "c-greenhouse",
    "canvas_ref",
    { x: 1600, y: 360, width: 260, height: 96 },
    {
      canvasRefId: "c-loop",
    },
  ),
  el(
    "gh-u3",
    "c-greenhouse",
    "understanding",
    { x: 1600, y: 560, width: 300, height: 168 },
    {
      understandingId: "u-return-water",
    },
  ),
  el(
    "gh-t2",
    "c-greenhouse",
    "text",
    { x: 1420, y: 120, width: 260, height: 56 },
    {
      props: { text: "主线：水分信号 → 调度决策" },
    },
  ),
];

const greenhouseEdges: CanvasEdgeDTO[] = [
  edge("e-1", "c-greenhouse", "gh-u1", "gh-u2", "水分→决策"),
  edge("e-2", "c-greenhouse", "gh-u1", "gh-t1", null),
  edge("e-3", "c-greenhouse", "gh-t1", "gh-s1", null),
  edge("e-4", "c-greenhouse", "gh-s1", "gh-s2", null),
  edge("e-5", "c-greenhouse", "gh-u2", "gh-ref", "控制回路", { lineStyle: "dashed" }),
  edge("e-6", "c-greenhouse", "gh-ref", "gh-u3", "参考"),
  edge("e-7", "c-greenhouse", "gh-c1", "gh-c3", null),
  edge("e-8", "c-greenhouse", "gh-c2", "gh-c4", null),
  edge("e-9", "c-greenhouse", "gh-u1", "gh-g1", "下发", { lineStyle: "dashed" }),
];

const loopElements: CanvasElementDTO[] = [
  el(
    "lp-u1",
    "c-loop",
    "understanding",
    { x: 300, y: 240, width: 300, height: 176 },
    {
      understandingId: "u-return-water",
    },
  ),
  el(
    "lp-t1",
    "c-loop",
    "text",
    { x: 760, y: 260, width: 260, height: 56 },
    {
      props: { text: "回水汇聚点，温度混合不可分" },
    },
  ),
  el(
    "lp-s1",
    "c-loop",
    "shape",
    { x: 300, y: 560, width: 160, height: 84 },
    {
      props: { shapeType: "rect" },
    },
  ),
  el(
    "lp-t2",
    "c-loop",
    "text",
    { x: 560, y: 580, width: 240, height: 56 },
    {
      props: { text: "异常时人工复核" },
    },
  ),
];

const loopEdges: CanvasEdgeDTO[] = [
  edge("le-1", "c-loop", "lp-u1", "lp-t1", null),
  edge("le-2", "c-loop", "lp-t1", "lp-s1", null),
  edge("le-3", "c-loop", "lp-s1", "lp-t2", null),
];

const knowledgeElements: CanvasElementDTO[] = [
  el(
    "kw-u1",
    "c-knowledge",
    "understanding",
    { x: 260, y: 220, width: 300, height: 176 },
    {
      understandingId: "u-iteration",
    },
  ),
  el(
    "kw-u2",
    "c-knowledge",
    "understanding",
    { x: 260, y: 560, width: 300, height: 176 },
    {
      understandingId: "u-existence",
    },
  ),
  el(
    "kw-t1",
    "c-knowledge",
    "text",
    { x: 700, y: 240, width: 280, height: 56 },
    {
      props: { text: "现象 → 机制 → 可迁移判断" },
    },
  ),
];

const knowledgeEdges: CanvasEdgeDTO[] = [edge("ke-1", "c-knowledge", "kw-u1", "kw-u2", null)];

const settleElements: CanvasElementDTO[] = [
  el(
    "st-t1",
    "c-settle",
    "text",
    { x: 320, y: 240, width: 320, height: 56 },
    {
      props: { text: "从对话一键沉淀的画布（U4 入口演示）" },
    },
  ),
  el(
    "st-ref",
    "c-settle",
    "canvas_ref",
    { x: 320, y: 420, width: 260, height: 96 },
    {
      canvasRefId: "c-greenhouse",
    },
  ),
];

const settleEdges: CanvasEdgeDTO[] = [edge("se-1", "c-settle", "st-t1", "st-ref", null)];

export const WIREFRAME_CANVAS_DETAILS: Record<string, CanvasDetailDTO> = {
  "c-greenhouse": {
    canvas: WIREFRAME_CANVASES[0]!,
    elements: greenhouseElements,
    edges: greenhouseEdges,
    understandingRefs: ["u-irrigation", "u-moisture", "u-return-water"].map((id) => {
      const view = WIREFRAME_UNDERSTANDINGS[id]!;
      return { id, title: view.title, body: view.body, deleted: false };
    }),
    referencedCanvases: [{ id: "c-loop", title: "灌溉控制回路细节", deleted: false }],
  },
  "c-loop": {
    canvas: WIREFRAME_CANVASES[1]!,
    elements: loopElements,
    edges: loopEdges,
    understandingRefs: [
      {
        id: "u-return-water",
        title: "回水温度是滞后信号",
        body: WIREFRAME_UNDERSTANDINGS["u-return-water"]!.body,
        deleted: false,
      },
    ],
    referencedCanvases: [],
  },
  "c-knowledge": {
    canvas: WIREFRAME_CANVASES[2]!,
    elements: knowledgeElements,
    edges: knowledgeEdges,
    understandingRefs: [
      {
        id: "u-iteration",
        title: "心智模型的迭代三段式",
        body: WIREFRAME_UNDERSTANDINGS["u-iteration"]!.body,
        deleted: false,
      },
      {
        id: "u-existence",
        title: "存在不需要被证明",
        body: WIREFRAME_UNDERSTANDINGS["u-existence"]!.body,
        deleted: false,
      },
    ],
    referencedCanvases: [],
  },
  "c-settle": {
    canvas: WIREFRAME_CANVASES[3]!,
    elements: settleElements,
    edges: settleEdges,
    understandingRefs: [],
    referencedCanvases: [{ id: "c-greenhouse", title: "温室工程整体方案", deleted: false }],
  },
};

// ─── 素材库（右侧单面板 · 库模式） ────────────────────────────────────────────

export type LibraryItemType = "understanding" | "context" | "domain" | "canvas";

export type LibraryItem = {
  type: LibraryItemType;
  id: string;
  title: string;
  meta: string;
  Icon: ComponentType<LucideProps>;
};

const CONTEXT_ICON: Record<string, ComponentType<LucideProps>> = {
  experience: User,
  article: FileText,
  ai: BookOpen,
  other: FileText,
};

export const WIREFRAME_LIBRARY: LibraryItem[] = [
  ...Object.values(WIREFRAME_UNDERSTANDINGS).map((view) => ({
    type: "understanding" as const,
    id: view.id,
    title: view.title,
    meta: `${view.contextCount} 上下文 · ${view.mentionCount} 引用`,
    Icon: FileText,
  })),
  ...Object.entries(WIREFRAME_CONTEXTS).flatMap(([understandingId, contexts]) =>
    contexts.map((ctx) => ({
      type: "context" as const,
      id: ctx.id,
      title: ctx.title || "未命名上下文",
      meta: understandingId,
      Icon: CONTEXT_ICON[ctx.medium] ?? FileText,
    })),
  ),
  ...WIREFRAME_DOMAINS.map((domain) => ({
    type: "domain" as const,
    id: domain.id,
    title: domain.name,
    meta: "领域",
    Icon: FolderTree,
  })),
  ...WIREFRAME_CANVASES.map((canvas) => ({
    type: "canvas" as const,
    id: canvas.id,
    title: canvas.title,
    meta: canvas.description ?? "画布",
    Icon: PanelsTopLeft,
  })),
];
