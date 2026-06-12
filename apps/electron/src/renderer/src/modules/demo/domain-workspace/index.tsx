/**
 * Domain Workspace Demo
 *
 * Hierarchy: tokens.md
 * Styles:    styles.ts
 */

import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@renderer/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@renderer/components/ui/sidebar";
import { Textarea } from "@renderer/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@renderer/components/ui/toggle-group";
import { cn } from "@renderer/lib/utils";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { BookOpen, Bot, Brain, ChevronDown, Plus, Sparkles } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type CategoryId =
  | "ai"
  | "ai-workflow"
  | "ai-skill"
  | "trading"
  | "trading-mindset"
  | "trading-system"
  | "trading-ict"
  | "product"
  | "cognition"
  | "learning"
  | "dao"
  | "project";

type SourceType = "experience" | "video" | "book" | "article" | "opinion" | "ai";

type SourceContext = {
  id: string;
  sourceType: SourceType;
  sourceName: string;
  content: string;
};

type Understanding = {
  id: string;
  categoryId: CategoryId;
  title: string;
  body: string;
  contexts: SourceContext[];
  updatedAt: string;
};

// ─── Static data ────────────────────────────────────────────────────────────

const SOURCE_TYPE_OPTIONS: Array<{ value: SourceType; label: string }> = [
  { value: "experience", label: "个人经历" },
  { value: "video", label: "视频" },
  { value: "book", label: "书籍" },
  { value: "article", label: "文章" },
  { value: "opinion", label: "他人观点" },
  { value: "ai", label: "AI 生成" },
];

const SOURCE_LABELS = new Map(SOURCE_TYPE_OPTIONS.map((o) => [o.value, o.label]));

const categories: Array<{ id: CategoryId; name: string; parentId?: CategoryId }> = [
  { id: "cognition", name: "认知" },
  { id: "learning", name: "有效学习", parentId: "cognition" },
  { id: "dao", name: "道", parentId: "cognition" },
  { id: "project", name: "项目管理" },
  { id: "trading", name: "交易" },
  { id: "trading-mindset", name: "心智认知", parentId: "trading" },
  { id: "trading-system", name: "系统构建", parentId: "trading" },
  { id: "trading-ict", name: "ICT", parentId: "trading" },
  { id: "ai", name: "AI" },
  { id: "ai-workflow", name: "workflow 搭建", parentId: "ai" },
  { id: "ai-skill", name: "skill", parentId: "ai" },
  { id: "product", name: "产品设计" },
];

const understandings: Understanding[] = [
  {
    id: "u-feedback-loop",
    categoryId: "project",
    title: "Feedback Loop",
    body: "在 [[放弃学习认知可以理解领域的幻想]] 的基础上，重要的是如何理解一个领域内的精进过程。\n\n规划不要求绝对正确，但一定要求可迭代。一个 plan 做完以后，我至少应该知道自己的假设是对的还是错的；失败后能知道这个领域里什么不成立，成功后能得到什么经验。",
    contexts: [
      {
        id: "ctx-feedback-1",
        sourceType: "experience",
        sourceName: "做 Reflecta Agent 工作流时的反复返工",
        content:
          "一开始想把工作流一次性设计完整，结果越设计越复杂。后来意识到，真正重要的是把每次迭代的反馈压薄。\n\n当时我以为问题出在 prompt 不够完整，所以不断让 AI 补充流程、补充边界、补充异常情况。但补得越多，我越难判断它是否真的适合当前场景。最后发现问题不是信息不够，而是我没有把每轮迭代的目标和可验证结果压得足够小。",
      },
      {
        id: "ctx-feedback-2",
        sourceType: "ai",
        sourceName: "和 AI 讨论 planning 和 validation",
        content:
          "AI 给了很多流程建议，但只有当我把它们压回自己的项目场景里，才知道哪些建议真的能用。\n\n这段对话里，AI 倾向于把 planning 拆得很完整：目标、约束、验收标准、风险、迭代节奏、回滚方案。表面上每个点都有道理，但如果全部塞进一次小迭代里，就会让执行成本超过验证成本。\n\n我真正留下来的不是那套完整流程，而是一个更小的判断：规划必须暴露假设，并且每轮执行之后能返回一个明确反馈。只要这点成立，规划就不要求绝对正确。",
      },
    ],
    updatedAt: "今天 16:40",
  },
  {
    id: "u-learning-fantasy",
    categoryId: "dao",
    title: "放弃学习认知可以理解领域的幻想",
    body: "我不能通过抽象地学习认知，就幻想自己理解了一个领域。领域理解必须进入具体实践、具体问题和具体反馈。\n\n这个理解后来影响了 [[Feedback Loop]]：如果没有反馈，所谓认知只是悬空的解释。",
    contexts: [
      {
        id: "ctx-learning-1",
        sourceType: "experience",
        sourceName: "多次试图用抽象方法理解新领域",
        content:
          "读了很多方法论以后会短暂觉得自己理解了，但真正进入项目或交易场景时，还是不知道下一步怎么判断。",
      },
    ],
    updatedAt: "昨天 22:18",
  },
  {
    id: "u-trading-measure",
    categoryId: "trading-mindset",
    title: "交易概念：丈量市场的尺子",
    body: "交易概念不是为了背定义，而是为了丈量市场。一个概念如果不能帮助我区分不同市场状态，它就只是术语。\n\n这个判断和 [[复盘的价值在于积累领域经验]] 有关：复盘不是记录情绪，而是校准我用来丈量市场的尺子。",
    contexts: [
      {
        id: "ctx-trading-1",
        sourceType: "experience",
        sourceName: "盘后复盘发现自己只是在套术语",
        content:
          "当时我能说出很多 ICT 词，但面对具体行情时不知道它们分别解释了什么、不能解释什么。\n\n我意识到一个概念如果不能让我在图上区分 A 情况和 B 情况，它就还不是我的工具。它只是一个看起来专业的词。",
      },
      {
        id: "ctx-trading-2",
        sourceType: "video",
        sourceName: "ICT 相关视频学习",
        content: "视频里的概念只有和自己的交易截图、失败案例对照时，才开始变成可用判断。",
      },
      {
        id: "ctx-trading-3",
        sourceType: "article",
        sourceName: "@trader-c 《大空头》说：你应该有自己的线团",
        content:
          "一个交易者的飞轮：研究越多，越自信；越自信，越敢动；越敢动，越能赢；越能赢，越想研究。\n\n大多数人把研究当作交易之前的准备工作。但这篇文章说的是另一件事：研究不是准备，研究是引擎本身。\n\n文章用忒修斯进入迷宫前拿到线团的故事解释交易者和市场的关系。线团不能杀死怪物，也不能照亮迷宫；线团做的事情只有一件：让你知道自己走过了哪里。\n\n这个比喻对我有触动，因为我在复盘时经常只记得结论和情绪，却不知道自己判断从哪里开始、在哪里转弯、哪里是死路。没有线团，我就不敢走深；不敢走深，我就永远到不了真正的问题。\n\n所以这篇文章不只是关于\u201c记录交易\u201d，而是关于研究如何变成交易者的路径记忆。它让我重新理解\u201c概念\u201d的作用：概念不是术语，不是为了显得专业，而是为了把市场这座迷宫切出可回溯的路径。",
      },
    ],
    updatedAt: "6 月 8 日",
  },
  {
    id: "u-review",
    categoryId: "trading-system",
    title: "复盘的价值在于积累领域经验",
    body: "复盘的核心不是写日记，而是让一次实践变成下一次判断的上下文。\n\n如果我只记录结果，不追问当时依据了什么假设，就无法更新 [[交易概念：丈量市场的尺子]]。",
    contexts: [
      {
        id: "ctx-review-1",
        sourceType: "experience",
        sourceName: "一次交易亏损后的复盘",
        content:
          "真正有价值的不是\u201c亏了\u201d，而是我当时依据的假设、情绪和执行偏差。它们会影响下一次判断。",
      },
    ],
    updatedAt: "6 月 6 日",
  },
  {
    id: "u-ai-boundary",
    categoryId: "ai-skill",
    title: "认知边界：AI能力的天花板",
    body: "AI 可以补信息、给建议、提出候选表达，但不能替我形成理解。\n\n当我对一个问题没有心理表征时，AI 生成越多，越容易让我失去判断边界。这个问题也出现在 [[AI工作流：先建心理表征再控信息边界]]。",
    contexts: [
      {
        id: "ctx-ai-boundary-1",
        sourceType: "experience",
        sourceName: "让 AI 写 human readable 文档时失控",
        content:
          "AI 加了很多我不理解的结构和边界。表面上文档更完整，但我无法判断它为什么这么写。\n\n最危险的地方在于，它生成的是一套看起来很专业的系统。每个小节都像是合理的，每个判断都有术语支撑，但我无法把它和自己的真实场景对应起来。于是我既不敢删，也不敢用。\n\n这让我意识到，AI 的上限经常不是模型能力，而是我自己的心理表征。如果我不知道一个产物应该如何服务当前问题，AI 生成得越完整，越会把我推离问题。",
      },
    ],
    updatedAt: "今天 12:22",
  },
  {
    id: "u-ai-workflow",
    categoryId: "ai-workflow",
    title: "AI工作流：先建心理表征再控信息边界",
    body: "让 AI 参与工作流之前，我要先知道自己正在解决什么问题、有哪些可检验结果。\n\n否则 AI 会不断扩写流程，让复杂度爆炸。这个理解承接 [[认知边界：AI能力的天花板]]。",
    contexts: [
      {
        id: "ctx-ai-workflow-1",
        sourceType: "experience",
        sourceName: "搭建 Agent 产出规范时反复膨胀",
        content:
          "我给 AI 一个 MVP 版本，它会不断补流程。没有心理表征时，我很难判断哪些流程是必要的。",
      },
    ],
    updatedAt: "昨天 19:03",
  },
  {
    id: "u-pmf-vp",
    categoryId: "product",
    title: "PMF - Value Proposition",
    body: "Reflecta 不是让用户管理资料，而是帮助用户把学习、实践和对话沉淀成可追溯的个人理解。\n\n产品形态必须服务这个核心：用户回到某个领域时，能看到自己的理解从哪些上下文里长出来。",
    contexts: [
      {
        id: "ctx-pmf-1",
        sourceType: "experience",
        sourceName: "做 Reflecta Agent 时发现 chat 方案和需求距离很远",
        content:
          "重点不是 chat panel/tree 这些形态，而是用户如何简单、高效地在产品中实现自己的需求，并且能主动提及上下文。",
      },
      {
        id: "ctx-pmf-2",
        sourceType: "ai",
        sourceName: "和 AI 讨论 PMF value proposition",
        content:
          "讨论后形成共识：人是大脑，AI 是辅助；用户手动表达理解本身就是整理过程。\n\nAI 可以帮助提出追问、提供候选表达、补充对比材料，但最终写进知识网的必须是用户理解后的表达。如果用户没有经过咀嚼，AI 直接总结出来的内容不会刻进用户大脑，也不能代表用户的知识边界。",
      },
    ],
    updatedAt: "今天 09:34",
  },
];

// ─── Organism recipes ────────────────────────────────────────────────────────

const ui = {
  page: "flex h-full w-full overflow-hidden bg-background text-foreground",

  navigationRail: "w-[220px] shrink-0 border-r border-border/60 bg-sidebar",
  navigationTree: "flex flex-col gap-0.5",
  navRow: cn(
    "h-8 rounded-md px-2 text-sm font-normal text-sidebar-foreground/75",
    "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
    "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground",
    "[&_svg]:text-sidebar-foreground/55 data-[active=true]:[&_svg]:text-sidebar-accent-foreground/80",
  ),
  navSubRow: cn(
    "h-7 rounded-md px-2 text-sm text-sidebar-foreground/70",
    "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
    "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground",
    "[&_svg]:text-sidebar-foreground/55 data-[active=true]:[&_svg]:text-sidebar-accent-foreground/80",
  ),

  workspace: "flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background",

  indexPane: "flex w-[326px] shrink-0 flex-col border-r border-border/60 bg-background",
  indexToolbar: "flex shrink-0 flex-col gap-2.5 px-3.5 py-3",
  indexToolbarRow: "flex min-w-0 items-center gap-2",
  breadcrumb: "min-w-0 flex-1 truncate text-xs text-muted-foreground",
  createTool: "h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground",
  search: cn(
    "h-7 w-full rounded-md border-border/45 bg-muted/30 text-xs shadow-none",
    "placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-border/70",
  ),
  indexList: "flex flex-col gap-1.5 px-3 py-2.5",
  createUnderstandingRow: cn(
    "w-full rounded-lg border border-border/35 bg-transparent px-3 py-2 text-left shadow-none",
    "text-sm font-medium text-muted-foreground transition-[background-color,border-color,color] duration-150",
    "hover:border-border/65 hover:bg-muted/35 hover:text-foreground",
  ),
  understandingRow: cn(
    "w-full rounded-lg border border-l-2 px-3 py-2.5 text-left shadow-none",
    "transition-[background-color,border-color,color] duration-150",
  ),
  understandingRowIdle:
    "border-border/45 border-l-transparent bg-background/40 hover:border-border/70 hover:bg-muted/30",
  understandingRowSelected: "border-border/75 border-l-foreground/35 bg-muted/45",
  understandingTitle: "text-sm font-medium leading-5 text-foreground",
  understandingTitleMuted: "text-sm font-medium leading-5 text-foreground/90",
  understandingExcerpt: "mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground",
  rowDate: "shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground",

  documentPane: "flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background",
  documentFrame: "mx-auto flex min-h-full w-full max-w-2xl flex-col gap-6 px-10 py-8",
  documentIdentity: "flex flex-col gap-2 border-b border-border/45 pb-5",
  whisper: "text-xs text-muted-foreground",
  documentTitle: cn(
    "h-auto border-transparent bg-transparent px-0 py-0 shadow-none",
    "text-[1.625rem] font-semibold leading-tight tracking-normal text-foreground",
    "placeholder:text-muted-foreground/55 focus-visible:border-transparent focus-visible:ring-0",
  ),
  documentBody: cn(
    "min-h-[250px] resize-none border-transparent bg-transparent px-0 py-0 shadow-none",
    "text-[1.0625rem] leading-[1.85] text-foreground",
    "placeholder:text-muted-foreground/55 focus-visible:border-transparent focus-visible:ring-0",
  ),
  evidenceArea: "flex flex-col gap-2 pt-1",
  sourceTrace: cn(
    "w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 text-left shadow-none",
    "transition-[background-color,border-color,color] duration-150",
    "hover:border-border/70 hover:bg-muted/35",
  ),
  sourceTraceHeader: "flex min-w-0 items-center gap-2",
  sourceBadge:
    "h-5 rounded-md border-border/50 px-1.5 text-[11px] font-normal text-muted-foreground",
  sourceTitle: "min-w-0 flex-1 truncate text-sm font-medium text-foreground/90",
  sourceExcerpt: "mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground",
  provenanceRow: "flex min-w-0 gap-4 pt-1",

  sourceDraftSurface: "rounded-lg border border-border/45 bg-muted/20 p-3 shadow-none",
  field:
    "border-border/45 bg-background/60 shadow-none focus-visible:ring-1 focus-visible:ring-border/70",
  emptyState: "flex h-full items-center justify-center",

  sourceDetailOverlay: "w-[min(720px,56vw)] bg-card shadow-xl",
  drawerTitleInput: cn(
    "mt-2 h-auto border-transparent bg-transparent px-0 shadow-none",
    "text-lg font-semibold text-foreground",
    "focus-visible:border-transparent focus-visible:ring-0",
  ),
} as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export function DomainWorkspaceDemoPage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategoryId>("product");
  const [selectedId, setSelectedId] = useState("u-pmf-vp");
  const [isComposing, setIsComposing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const visibleUnderstandings = useMemo(() => {
    const ids = collectCategoryIds(selectedCategoryId);
    const q = searchQuery.trim().toLowerCase();
    return understandings.filter((u) => {
      if (!ids.has(u.categoryId)) return false;
      if (!q) return true;
      return `${u.title} ${stripWikiSyntax(u.body)}`.toLowerCase().includes(q);
    });
  }, [selectedCategoryId, searchQuery]);

  const activeUnderstanding = isComposing
    ? null
    : (understandings.find((u) => u.id === selectedId) ?? visibleUnderstandings[0] ?? null);

  function selectCategory(id: CategoryId) {
    const ids = collectCategoryIds(id);
    const first = understandings.find((u) => ids.has(u.categoryId));
    setSelectedCategoryId(id);
    setSelectedId(first?.id ?? "");
    setIsComposing(false);
  }

  return (
    <SidebarProvider className={ui.page}>
      <Sidebar
        collapsible="none"
        className={ui.navigationRail}
        style={{ "--sidebar-width": "13.75rem" } as CSSProperties}
      >
        <SidebarContent className="px-2 py-2">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className={ui.navigationTree} aria-label="领域分类">
                {categories
                  .filter((c) => !c.parentId)
                  .map((c) => (
                    <NavItem
                      key={c.id}
                      category={c}
                      selectedCategoryId={selectedCategoryId}
                      onSelect={selectCategory}
                    />
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <div className={ui.workspace}>
        <aside className={ui.indexPane} aria-label="理解索引">
          <div className={ui.indexToolbar}>
            <div className={ui.indexToolbarRow}>
              <p className={ui.breadcrumb}>{categoryPath(selectedCategoryId)}</p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className={ui.createTool}
                onClick={() => setIsComposing(true)}
              >
                <Plus />
                新建
              </Button>
            </div>
            <Input
              aria-label="查找已有理解"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="查找已有理解"
              className={ui.search}
            />
          </div>

          <ScrollArea className="flex-1">
            <div aria-label="理解列表" className={ui.indexList}>
              {!isComposing && (
                <button
                  type="button"
                  className={ui.createUnderstandingRow}
                  onClick={() => setIsComposing(true)}
                >
                  写下新理解
                </button>
              )}

              {visibleUnderstandings.map((u) => {
                const selected = !isComposing && activeUnderstanding?.id === u.id;
                return (
                  <UnderstandingRow
                    key={u.id}
                    understanding={u}
                    selected={selected}
                    onSelect={() => {
                      setSelectedId(u.id);
                      setIsComposing(false);
                    }}
                  />
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        <main className={ui.documentPane}>
          {isComposing ? (
            <ComposeSurface categoryId={selectedCategoryId} />
          ) : activeUnderstanding ? (
            <ReadingSurface understanding={activeUnderstanding} />
          ) : (
            <EmptySurface />
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}

function UnderstandingRow({
  understanding,
  selected,
  onSelect,
}: {
  understanding: Understanding;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      className={cn(
        ui.understandingRow,
        selected ? ui.understandingRowSelected : ui.understandingRowIdle,
      )}
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={selected ? ui.understandingTitle : ui.understandingTitleMuted}>
            {understanding.title}
          </p>
          <p className={ui.understandingExcerpt}>{stripWikiSyntax(understanding.body)}</p>
        </div>
        <span className={ui.rowDate}>{understanding.updatedAt}</span>
      </div>
    </button>
  );
}

function NavItem({
  category,
  selectedCategoryId,
  onSelect,
}: {
  category: (typeof categories)[number];
  selectedCategoryId: CategoryId;
  onSelect: (id: CategoryId) => void;
}) {
  const children = categories.filter((c) => c.parentId === category.id);
  const active = selectedCategoryId === category.id;

  if (children.length > 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          className={ui.navRow}
          isActive={active}
          onClick={() => onSelect(category.id)}
        >
          <ChevronDown />
          <CategoryIcon categoryId={category.id} />
          <span>{category.name}</span>
        </SidebarMenuButton>
        <SidebarMenuSub>
          {children.map((child) => (
            <NavSubItem
              key={child.id}
              category={child}
              selectedCategoryId={selectedCategoryId}
              onSelect={onSelect}
            />
          ))}
        </SidebarMenuSub>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className={ui.navRow}
        isActive={active}
        onClick={() => onSelect(category.id)}
      >
        <CategoryIcon categoryId={category.id} />
        <span>{category.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavSubItem({
  category,
  selectedCategoryId,
  onSelect,
}: {
  category: (typeof categories)[number];
  selectedCategoryId: CategoryId;
  onSelect: (id: CategoryId) => void;
}) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        className={ui.navSubRow}
        isActive={selectedCategoryId === category.id}
        onClick={() => onSelect(category.id)}
      >
        <CategoryIcon categoryId={category.id} />
        <span>{category.name}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function CategoryIcon({ categoryId }: { categoryId: CategoryId }) {
  if (categoryId.startsWith("trading")) return <Brain size={16} />;
  if (categoryId.startsWith("ai")) return <Bot size={16} />;
  if (categoryId === "product") return <Sparkles size={16} />;
  return <BookOpen size={16} />;
}

// ─── Document organisms ──────────────────────────────────────────────────────

function ReadingSurface({ understanding }: { understanding: Understanding }) {
  const [openContextId, setOpenContextId] = useState<string | null>(null);
  const [title, setTitle] = useState(understanding.title);
  const [body, setBody] = useState(understanding.body);

  useEffect(() => {
    setOpenContextId(null);
    setTitle(understanding.title);
    setBody(understanding.body);
  }, [understanding.id]);

  const wikiLinks = extractWikiLinks(body);
  const openContext = openContextId
    ? (understanding.contexts.find((c) => c.id === openContextId) ?? null)
    : null;

  return (
    <>
      <ScrollArea className="h-full">
        <article className={ui.documentFrame}>
          <header className={ui.documentIdentity}>
            <p className={ui.whisper}>{understanding.updatedAt}</p>
            <Input
              aria-label="理解标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={ui.documentTitle}
            />
          </header>

          <Textarea
            aria-label="理解正文"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className={ui.documentBody}
          />

          <section className={ui.evidenceArea} aria-label="来源追溯">
            {understanding.contexts.map((ctx) => (
              <SourceTrace key={ctx.id} context={ctx} onOpen={() => setOpenContextId(ctx.id)} />
            ))}

            {understanding.contexts.length > 0 && (
              <div className={ui.provenanceRow}>
                <p className={cn("min-w-0 flex-1 leading-5", ui.whisper)}>
                  {understanding.contexts.length} 个来源
                  {understanding.contexts[0]
                    ? ` · ${SOURCE_LABELS.get(understanding.contexts[0].sourceType)} / ${understanding.contexts[0].sourceName || "未命名来源"}`
                    : ""}
                </p>
                <p className={cn("min-w-0 flex-1 truncate leading-5", ui.whisper)}>
                  {wikiLinks.length
                    ? `${wikiLinks.length} 个双链 · ${wikiLinks.map((t) => `[[${t}]]`).join(" / ")}`
                    : "正文里还没有双链"}
                </p>
              </div>
            )}
          </section>
        </article>
      </ScrollArea>

      {openContext && (
        <ContextDrawer context={openContext} onClose={() => setOpenContextId(null)} />
      )}
    </>
  );
}

function SourceTrace({ context, onOpen }: { context: SourceContext; onOpen: () => void }) {
  return (
    <button type="button" className={ui.sourceTrace} onClick={onOpen}>
      <div className={ui.sourceTraceHeader}>
        <Badge variant="outline" className={ui.sourceBadge}>
          {SOURCE_LABELS.get(context.sourceType)}
        </Badge>
        <p className={ui.sourceTitle}>
          {context.sourceName || SOURCE_LABELS.get(context.sourceType)}
        </p>
        <span className={cn("shrink-0 tabular-nums", ui.whisper)}>{context.content.length} 字</span>
      </div>
      <p className={ui.sourceExcerpt}>{context.content}</p>
    </button>
  );
}

function ComposeSurface({ categoryId }: { categoryId: CategoryId }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <ScrollArea className="h-full">
      <article className={ui.documentFrame}>
        <header className={ui.documentIdentity}>
          <p className={ui.whisper}>写入 {categoryPath(categoryId)}</p>
          <Input
            aria-label="新理解标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="写下一个刚形成的理解"
            className={ui.documentTitle}
          />
        </header>

        <Textarea
          aria-label="新理解正文"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="用自己的话写下理解。用 [[已有理解标题]] 连接其他理解。"
          className={ui.documentBody}
        />

        <section className={ui.evidenceArea}>
          <div className={ui.sourceDraftSurface}>
            <SourceDraftForm />
          </div>
          <Button type="button" size="sm" variant="secondary" className="w-fit">
            <Plus />
            添加一个来源
          </Button>
        </section>
      </article>
    </ScrollArea>
  );
}

function SourceDraftForm() {
  const [sourceType, setSourceType] = useState<SourceType>("experience");
  const [sourceName, setSourceName] = useState("");
  const [content, setContent] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={sourceType}
        onValueChange={(v) => v && setSourceType(v as SourceType)}
        className="flex flex-wrap"
        aria-label="来源类型"
      >
        {SOURCE_TYPE_OPTIONS.map((opt) => (
          <ToggleGroupItem key={opt.value} value={opt.value} className="px-3">
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Input
        aria-label="来源标题"
        value={sourceName}
        onChange={(e) => setSourceName(e.target.value)}
        placeholder={sourceType === "experience" ? "来源标题（可选）" : "来源标题 / 名称"}
        className={ui.field}
      />

      <Textarea
        aria-label="来源内容"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        className={ui.field}
        placeholder="保留这个来源里真正触发你、支撑你形成理解的上下文。它可以很长。"
      />
    </div>
  );
}

function ContextDrawer({ context, onClose }: { context: SourceContext; onClose: () => void }) {
  const [sourceName, setSourceName] = useState(context.sourceName);
  const [content, setContent] = useState(context.content);

  useEffect(() => {
    setSourceName(context.sourceName);
    setContent(context.content);
  }, [context.id]);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className={ui.sourceDetailOverlay}>
        <SheetHeader>
          <SheetTitle className="sr-only">来源详情</SheetTitle>
          <div className="min-w-0 flex-1 pr-8">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={ui.sourceBadge}>
                {SOURCE_LABELS.get(context.sourceType)}
              </Badge>
              <span className={cn("tabular-nums", ui.whisper)}>{content.length} 字</span>
            </div>
            <Input
              aria-label="来源标题"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder={SOURCE_LABELS.get(context.sourceType)}
              className={ui.drawerTitleInput}
            />
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 px-4 pb-4">
          <Textarea
            aria-label="来源内容"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
            className={cn("min-h-full", ui.field)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptySurface() {
  return (
    <div className={ui.emptyState}>
      <p className={cn("max-w-sm text-center leading-relaxed", ui.whisper)}>
        选择一条理解，查看正文与来源。
      </p>
    </div>
  );
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function collectCategoryIds(id: CategoryId): Set<CategoryId> {
  const ids = new Set<CategoryId>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        changed = true;
      }
    }
  }
  return ids;
}

function categoryPath(id: CategoryId): string {
  const c = categories.find((x) => x.id === id);
  if (!c) return "";
  if (!c.parentId) return c.name;
  return `${categoryPath(c.parentId)} / ${c.name}`;
}

function extractWikiLinks(body: string): string[] {
  return Array.from(
    new Set(
      Array.from(body.matchAll(/\[\[([^\]#]+)(?:#[^\]]+)?\]\]/g), (m) => m[1]?.trim()).filter(
        Boolean,
      ),
    ),
  );
}

function stripWikiSyntax(body: string): string {
  return body
    .replace(/\[\[([^\]#]+)(?:#[^\]]+)?\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
