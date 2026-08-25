import { addDays, format, startOfDay, subDays } from "date-fns";
import type { ResolveChatEntity } from "../chat/entity";
import type { DomainTreeNodeView } from "./domain-tree";
import type {
  ParticipationActivityDay,
  ParticipationAssetsView,
  ParticipationDayCounts,
  ParticipationDayDetail,
} from "./participation-overview";
import type { UnderstandingCardView } from "./understanding-card";

export const typicalDomains: DomainTreeNodeView[] = [
  {
    id: "product",
    name: "产品",
    children: [
      { id: "positioning", name: "定位与价值主张", children: [] },
      { id: "research", name: "用户研究", children: [] },
    ],
  },
  {
    id: "technology",
    name: "技术",
    children: [
      {
        id: "ui",
        name: "UI 架构",
        children: [
          { id: "storybook", name: "Storybook 组件验收", children: [] },
          { id: "streaming", name: "Agent Streaming Identity", children: [] },
        ],
      },
      { id: "server", name: "Server 与数据持久化", children: [] },
    ],
  },
  { id: "practice", name: "实践与复盘", children: [] },
];

export const typicalExpandedIds = ["technology", "ui"] as const;

export const deepDomains: DomainTreeNodeView[] = [
  {
    id: "root-long",
    name: "这是一个非常长的顶级 Domain 名称，用于观察截断",
    children: [
      {
        id: "level-2",
        name: "第二层级的名称同样非常长",
        children: [
          {
            id: "level-3",
            name: "第三层级",
            children: [
              {
                id: "level-4",
                name: "第四层级直到内容空间非常有限",
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
];

export const denseDomains: DomainTreeNodeView[] = [
  {
    id: "engineering",
    name: "设施工程与极端环境长期运行策略",
    children: [
      {
        id: "greenhouse",
        name: "极地温室",
        children: [
          {
            id: "irrigation",
            name: "低温条件下的分区灌溉与压力稳定",
            children: [
              {
                id: "night-shift",
                name: "夜班联调、异常复验与下一观察窗",
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `dense-domain-${index}`,
    name: `第 ${index + 1} 个模拟领域：用于观察大量顶级节点下的滚动`,
    children: [] as DomainTreeNodeView[],
  })),
];

export const denseExpandedIds = ["engineering", "greenhouse", "irrigation"] as const;

export type CaptureStoryCard = UnderstandingCardView & {
  domainIds: readonly string[];
};

export const typicalCard: CaptureStoryCard = {
  id: "understanding-irrigation",
  title: "低温环境下的分区灌溉策略",
  body: "不同种植槽根据 **基质含水率**、回水温度和主管压力获得独立灌溉窗口。",
  updatedLabel: "12 分钟前",
  contextCount: 4,
  mentionCount: 7,
  domainIds: ["practice"],
  domainNames: ["实践与复盘"],
};

export const emptyCard: CaptureStoryCard = {
  ...typicalCard,
  id: "understanding-empty",
  title: "尚未补充正文的理解",
  body: "",
  updatedLabel: "刚刚",
  contextCount: 0,
  mentionCount: 0,
  domainIds: ["practice"],
  domainNames: [],
};

export const untitledCard: CaptureStoryCard = {
  ...typicalCard,
  id: "understanding-untitled",
  title: "未命名理解",
  body: "标题为空时，生产侧会把首行或兜底文案传进来。",
  updatedLabel: "刚刚",
  contextCount: 0,
  mentionCount: 0,
  domainIds: ["practice"],
  domainNames: ["实践与复盘"],
};

export const longCard: CaptureStoryCard = {
  ...typicalCard,
  id: "understanding-long",
  title: "这是一个非常长的 Understanding 标题，用来观察标题与更新时间同时存在时是否正确截断",
  body: `# 分区灌溉

不同种植槽根据 **基质含水率**、回水温度和主管压力获得独立灌溉窗口。

- 先开启旁通阀
- 再依次开启支路
- 异常时转入人工复核

关联 [[u:understanding-pressure-check]]。

> 单个峰值不作为最终结论。
`,
  updatedLabel: "大约 1 年前",
  contextCount: 128,
  mentionCount: 256,
  domainIds: ["ui", "server"],
  domainNames: ["UI 架构", "Server 与数据持久化", "前端", "AI"],
};

export const typicalCards: CaptureStoryCard[] = [
  {
    id: "acceptance",
    title: "Storybook 只验收高价值组件",
    body: "标准表单、普通列表和详情的 ROI 较低，不单独建立 Story。关联 [[u:understanding-irrigation]]。",
    updatedLabel: "12 分钟前",
    contextCount: 4,
    mentionCount: 7,
    domainIds: ["storybook"],
    domainNames: ["Storybook 组件验收"],
  },
  {
    id: "streaming",
    title: "Streaming 必须保持稳定 Identity",
    body: "Tool root、item、Message 和 Proposal ID 在逐帧更新中保持不变。",
    updatedLabel: "1 小时前",
    contextCount: 2,
    mentionCount: 5,
    domainIds: ["streaming"],
    domainNames: ["Agent Streaming Identity"],
  },
  {
    id: "seam",
    title: "UI-owned interface 不依赖 Renderer runtime",
    body: "query、store、IPC 和 mutation 由 Adapter 持有。",
    updatedLabel: "昨天",
    contextCount: 3,
    mentionCount: 9,
    domainIds: ["ui"],
    domainNames: ["UI 架构"],
  },
  {
    ...emptyCard,
    id: "empty-practice",
    domainIds: ["practice"],
  },
  {
    id: "prompt-environment",
    title: "环境提示比意志力更可靠",
    body: "把工具放到手边，比提醒自己「下次注意」有效。",
    updatedLabel: "3 天前",
    contextCount: 1,
    mentionCount: 0,
    domainIds: ["positioning"],
    domainNames: ["定位与价值主张"],
  },
  {
    id: "mental-model",
    title: "心智模型的迭代三段式",
    body: "对任何一个领域的理解，迭代遵循三个阶段：\n\n1. 先看见现象\n2. 再抽出机制\n3. 最后压成可迁移的判断\n\n不能跳过，也不能卡在某一阶段。",
    updatedLabel: "4 天前",
    contextCount: 2,
    mentionCount: 3,
    domainIds: ["research"],
    domainNames: ["用户研究"],
  },
  typicalCard,
  longCard,
];

export const denseCards: CaptureStoryCard[] = Array.from({ length: 12 }, (_, index) => ({
  id: `dense-understanding-${index}`,
  title:
    index === 0
      ? "这是一个非常长的 Understanding 标题，用于同时观察标题、更新时间和选中状态的截断"
      : `模拟理解 ${index + 1}：极地温室第 ${(index % 4) + 1} 轮复验记录`,
  body:
    index % 3 === 0
      ? "这段 **Markdown** 摘要包含较长的中文内容、[链接](https://example.com/a/very/long/path) 和 `inlineCodeWithoutNaturalBreakPoint`，用于观察窄列中的五行截断。"
      : "分区灌溉需要同时观察入口温度、主管压力和支路阀门实际开度。",
  updatedLabel: index === 0 ? "大约 1 年前" : `${index + 2} 小时前`,
  contextCount: index * 3,
  mentionCount: index * 5,
  domainIds: [index < 4 ? "night-shift" : `dense-domain-${index % 8}`],
  domainNames:
    index < 4 ? ["夜班联调、异常复验与下一观察窗"] : [`第 ${(index % 8) + 1} 个模拟领域`],
}));

const STORY_ENTITY_LABELS: Record<string, string> = {
  "understanding:understanding-pressure-check": "主管压力复核",
  "understanding:understanding-irrigation": "低温环境下的分区灌溉策略",
};

export const resolveStoryWikiLink: ResolveChatEntity = (reference) => {
  const label = STORY_ENTITY_LABELS[`${reference.type}:${reference.id}`];
  if (!label) return { state: "unavailable", label: reference.id };
  return { state: "ready", label, canOpen: true };
};

function flattenDomainIds(nodes: readonly DomainTreeNodeView[]): string[] {
  return nodes.flatMap((node) => [node.id, ...flattenDomainIds(node.children)]);
}

export function descendantIdsIncludingSelf(
  nodes: readonly DomainTreeNodeView[],
  targetId: string,
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [node.id, ...flattenDomainIds(node.children)];
    const nested = descendantIdsIncludingSelf(node.children, targetId);
    if (nested) return nested;
  }
  return null;
}

export function cardsForDomain(
  cards: readonly CaptureStoryCard[],
  domains: readonly DomainTreeNodeView[],
  selectedId: string | null,
): CaptureStoryCard[] {
  if (!selectedId) return [...cards];
  const allowed = new Set(descendantIdsIncludingSelf(domains, selectedId) ?? [selectedId]);
  return cards.filter((card) => card.domainIds.some((id) => allowed.has(id)));
}

const STORY_TODAY = new Date("2026-08-24T12:00:00.000Z");
const PARTICIPATION_WINDOW_DAYS = 365;

function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function levelForCount(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

function activityDays(
  countsByDate: Readonly<Record<string, number>>,
  now = STORY_TODAY,
): ParticipationActivityDay[] {
  const start = startOfDay(subDays(now, PARTICIPATION_WINDOW_DAYS - 1));
  const today = dayKey(now);
  const days: ParticipationActivityDay[] = [];
  let cursor = start;
  while (dayKey(cursor) <= today) {
    const key = dayKey(cursor);
    const count = countsByDate[key] ?? 0;
    days.push({ date: key, count, level: levelForCount(count) });
    cursor = addDays(cursor, 1);
  }
  return days;
}

export const emptyParticipationAssets: ParticipationAssetsView = {
  understanding: 0,
  canvas: 0,
  context: 0,
};

export const typicalParticipationAssets: ParticipationAssetsView = {
  understanding: 8,
  canvas: 2,
  context: 3,
};

export const denseParticipationAssets: ParticipationAssetsView = {
  understanding: 128,
  canvas: 24,
  context: 56,
};

export const emptyParticipationDays = activityDays({});

const typicalCountsByDate: Record<string, number> = {
  "2026-08-24": 3,
  "2026-08-21": 1,
  "2026-08-18": 2,
  "2026-08-03": 5,
  "2026-07-22": 1,
  "2026-07-08": 4,
  "2026-06-18": 8,
  "2026-05-04": 2,
};

export const typicalParticipationDays = activityDays(typicalCountsByDate);

const typicalDayCounts: Record<string, ParticipationDayCounts> = {
  "2026-08-24": {
    conversations: 1,
    messages: 2,
    understandingCreated: 1,
    canvasCreated: 0,
    contextCreated: 1,
  },
  "2026-08-03": {
    conversations: 2,
    messages: 4,
    understandingCreated: 1,
    canvasCreated: 1,
    contextCreated: 0,
  },
  "2026-06-18": {
    conversations: 3,
    messages: 8,
    understandingCreated: 2,
    canvasCreated: 1,
    contextCreated: 2,
  },
};

export function typicalParticipationCounts(date: string): ParticipationDayCounts | undefined {
  return typicalDayCounts[date];
}

const typicalDayDetails: Record<string, ParticipationDayDetail> = {
  "2026-08-24": {
    sessions: [{ id: "s-today", title: "复核分区灌溉策略", messageCount: 2 }],
    understandings: [{ id: "acceptance", title: "Storybook 只验收高价值组件" }],
    contextCount: 1,
    canvases: [],
  },
  "2026-08-03": {
    sessions: [{ id: "s-aug", title: "画布连线与端口", messageCount: 4 }],
    understandings: [{ id: "seam", title: "UI-owned interface 不依赖 Renderer runtime" }],
    contextCount: 0,
    canvases: [{ id: "canvas-aug", title: "画布连线与端口" }],
  },
  "2026-06-18": {
    sessions: [
      { id: "s-june-1", title: "夜班联调记录", messageCount: 5 },
      { id: "s-june-2", title: "极地温室复验", messageCount: 3 },
    ],
    understandings: [
      { id: "irrigation", title: "低温环境下的分区灌溉策略" },
      { id: "untitled", title: "（无标题）" },
    ],
    contextCount: 2,
    canvases: [{ id: "canvas-june", title: "极地温室复验画布" }],
  },
};

export function typicalParticipationDetail(date: string): ParticipationDayDetail {
  return (
    typicalDayDetails[date] ?? { sessions: [], understandings: [], contextCount: 0, canvases: [] }
  );
}

const denseCountsByDate: Record<string, number> = Object.fromEntries(
  Array.from({ length: 48 }, (_, index) => {
    const date = format(subDays(STORY_TODAY, index * 3), "yyyy-MM-dd");
    const count = (index % 5) + 1 + (index % 3 === 0 ? 6 : 0);
    return [date, count];
  }),
);

export const denseParticipationDays = activityDays(denseCountsByDate);
