import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  BookOpen,
  FileText,
  FolderTree,
  MessageCircle,
  PanelsTopLeft,
  Search,
  User,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@reflecta/ui/components/badge";
import { Button } from "@reflecta/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@reflecta/ui/components/input-group";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import { SimpleMarkdownPreview } from "@reflecta/ui/editor";
import { cn } from "@reflecta/ui/lib/utils";
import type { ContextDTO } from "@shared/context";
import { PanelHeader } from "@renderer/modules/shared/layout/PanelHeader";
import { useCanvasWireframeStore, type DetailTarget } from "./wireframe-store";
import {
  WIREFRAME_CANVAS_DETAILS,
  WIREFRAME_CONTEXTS,
  WIREFRAME_DOMAINS,
  WIREFRAME_LIBRARY,
  WIREFRAME_UNDERSTANDINGS,
  type LibraryItem,
  type LibraryItemType,
} from "./wireframe-data";

/**
 * 画布线框 · 右侧单面板（库模式 / 详情模式互斥，C1）。
 *
 * 库模式：素材库（理解 / 上下文 / 领域 / 画布）——本轮为静态列表，点击条目进入详情；
 * 详情模式：选中元素或素材库条目的详情（v1 将复用 Capture 的 UnderstandingDetail 完整能力，
 * 此处先用同语言的最小骨架占位）。
 */

const TYPE_CHIPS: { value: LibraryItemType | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "understanding", label: "理解" },
  { value: "context", label: "上下文" },
  { value: "domain", label: "领域" },
  { value: "canvas", label: "画布" },
];

export function CanvasRightPanel() {
  const detailTarget = useCanvasWireframeStore((state) => state.detailTarget);
  const rightPanelMode = useCanvasWireframeStore((state) => state.rightPanelMode);
  const setRightPanelOpen = useCanvasWireframeStore((state) => state.setRightPanelOpen);

  return (
    <div
      data-testid="canvas-wireframe-right-panel"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
    >
      <PanelHeader className="gap-1 px-3">
        <ModeSwitcher mode={rightPanelMode} />
        <div className="ml-auto">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="收起面板"
            title="收起面板"
            onClick={() => setRightPanelOpen(false)}
          >
            <X size={15} />
          </Button>
        </div>
      </PanelHeader>
      <div className="min-h-0 flex-1">
        {rightPanelMode === "library" ? <LibraryView /> : <DetailView target={detailTarget} />}
      </div>
    </div>
  );
}

function ModeSwitcher({ mode }: { mode: "library" | "detail" }) {
  const openLibrary = useCanvasWireframeStore((state) => state.openLibrary);
  const inspectLibraryItem = useCanvasWireframeStore((state) => state.inspectLibraryItem);
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5"
      role="tablist"
      aria-label="面板模式"
    >
      <ModeButton
        active={mode === "library"}
        onClick={openLibrary}
        label="素材库"
        testId="canvas-wireframe-mode-library"
      />
      <ModeButton
        active={mode === "detail"}
        onClick={() => {
          // 切到详情但还没有对象时，回退素材库第一项
          const target = useCanvasWireframeStore.getState().detailTarget;
          if (!target) {
            const first = WIREFRAME_LIBRARY[0];
            if (first) inspectLibraryItem(first);
          }
        }}
        label="详情"
        testId="canvas-wireframe-mode-detail"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      className={cn(
        "h-7 rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ─── 库模式 ────────────────────────────────────────────────────────────────────

function LibraryView() {
  const inspectLibraryItem = useCanvasWireframeStore((state) => state.inspectLibraryItem);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<LibraryItemType | "all">("all");

  const items = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return WIREFRAME_LIBRARY.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (kw && !item.title.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [keyword, typeFilter]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="shrink-0 space-y-2 border-b px-3 py-2.5">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <Search className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索素材库"
          />
        </InputGroup>
        <div className="flex flex-wrap items-center gap-1">
          {TYPE_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={cn(
                "h-6 rounded-full px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                typeFilter === chip.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
              onClick={() => setTypeFilter(chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {items.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">没有匹配的条目</div>
        ) : (
          <div className="flex flex-col gap-0.5 p-1.5">
            {items.map((item) => (
              <button
                key={`${item.type}:${item.id}`}
                type="button"
                className="flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => inspectLibraryItem(item)}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <item.Icon size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block min-w-0 truncate font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{item.meta}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.type === "understanding"
                    ? "理解"
                    : item.type === "context"
                      ? "上下文"
                      : item.type === "domain"
                        ? "领域"
                        : "画布"}
                </span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground">
        素材库为静态演示；拖入画布 / 引用检索待实现
      </div>
    </div>
  );
}

// ─── 详情模式 ──────────────────────────────────────────────────────────────────

function DetailView({ target }: { target: DetailTarget | null }) {
  const selectedCanvasId = useCanvasWireframeStore((state) => state.selectedCanvasId);
  const detail = selectedCanvasId ? WIREFRAME_CANVAS_DETAILS[selectedCanvasId] : null;

  if (!target) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        选择画布元素或素材库条目查看详情
      </div>
    );
  }

  if (target.kind === "element" && detail) {
    const element = detail.elements.find((item) => item.id === target.elementId);
    if (!element) return <DetailEmpty />;
    return <ElementDetail elementId={element.id} />;
  }

  if (target.kind === "library") {
    return <LibraryItemDetail item={target.item} />;
  }

  return <DetailEmpty />;
}

function DetailEmpty() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 text-center text-sm text-muted-foreground">
      找不到该对象
    </div>
  );
}

/** 元素详情：按 kind 分发（理解走实体骨架，其余为几何/结构信息） */
function ElementDetail({ elementId }: { elementId: string }) {
  const canvasId = useCanvasWireframeStore((state) => state.selectedCanvasId);
  const detail = canvasId ? WIREFRAME_CANVAS_DETAILS[canvasId] : null;
  if (!canvasId || !detail) return null;
  const element = detail.elements.find((item) => item.id === elementId);
  if (!element) return null;

  switch (element.kind) {
    case "understanding":
      return element.understandingId ? (
        <UnderstandingDetailView view={WIREFRAME_UNDERSTANDINGS[element.understandingId]} />
      ) : (
        <DetailEmpty />
      );
    case "canvas_ref": {
      const target = detail.referencedCanvases.find((canvas) => canvas.id === element.canvasRefId);
      return (
        <CanvasRefDetailView
          title={target?.title ?? "目标画布"}
          canvasId={element.canvasRefId ?? ""}
        />
      );
    }
    case "group": {
      const children = detail.elements.filter((item) => item.parentId === element.id);
      return <GroupDetailView label={element.props.label} childrenElements={children} />;
    }
    default:
      return (
        <SimpleElementDetailView
          kind={element.kind}
          description={
            element.kind === "text"
              ? element.props.text
              : element.kind === "shape"
                ? element.props.shapeType === "circle"
                  ? "圆形 · 异常重试"
                  : "矩形 · 调度"
                : ""
          }
          coordinate={`x ${Math.round(element.x)} · y ${Math.round(element.y)} · ${Math.round(element.width)}×${Math.round(element.height)}`}
        />
      );
  }
}

function UnderstandingDetailView({ view }: { view: (typeof WIREFRAME_UNDERSTANDINGS)[string] }) {
  const contexts = WIREFRAME_CONTEXTS[view.id] ?? [];
  const canvasCount = Object.values(WIREFRAME_CANVAS_DETAILS).filter((detail) =>
    detail.understandingRefs.some((ref) => ref.id === view.id),
  ).length;

  return (
    <DetailArticle>
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            <FileText size={11} />
            理解
          </Badge>
          <span>{view.updatedLabel}</span>
          <span aria-hidden>·</span>
          <span className="min-w-0 truncate">
            {view.domainNames.length > 0 ? view.domainNames.join(" / ") : "未归入领域"}
          </span>
        </div>
        <h1 className="text-lg leading-snug font-semibold">{view.title}</h1>
      </header>

      <section className="mt-4 text-sm text-muted-foreground">
        <SimpleMarkdownPreview value={view.body} />
      </section>

      <section className="mt-6 flex flex-col gap-2 border-t border-border pt-5">
        <div className="flex items-center justify-between text-sm font-medium">
          上下文
          <span className="text-xs font-normal text-muted-foreground">{contexts.length} 条</span>
        </div>
        {contexts.length === 0 ? (
          <div className="text-sm text-muted-foreground">还没有上下文</div>
        ) : (
          contexts.map((context) => <ContextRow key={context.id} context={context} />)
        )}
      </section>

      <section className="mt-6 border-t border-border pt-5 text-xs text-muted-foreground">
        出现于 {canvasCount} 张画布 · v1 点击跳转画布（M6-6）
      </section>

      <section className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        ⚠ 线框占位：v1 详情面板将复用 Capture 的完整 UnderstandingDetail（编辑 / 上下文 / AI 能力）
      </section>
    </DetailArticle>
  );
}

function ContextRow({ context }: { context: ContextDTO }) {
  const Icon = CONTEXT_BADGE_ICON[context.medium];
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 text-left text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Badge variant="outline">
          <Icon size={11} />
          上下文
        </Badge>
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {context.title?.trim() || "未命名上下文"}
        </span>
      </div>
      {context.content ? (
        <div className="mt-1.5 text-muted-foreground">
          <SimpleMarkdownPreview value={context.content} lineClamp={1} />
        </div>
      ) : null}
    </div>
  );
}

const CONTEXT_BADGE_ICON: Record<ContextDTO["medium"], typeof User> = {
  experience: User,
  video: MessageCircle,
  book: BookOpen,
  article: FileText,
  opinion: MessageCircle,
  ai: BookOpen,
  other: FileText,
};

function CanvasRefDetailView({ title, canvasId }: { title: string; canvasId: string }) {
  const selectCanvas = useCanvasWireframeStore((state) => state.selectCanvas);
  return (
    <DetailArticle>
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            <PanelsTopLeft size={11} />
            画布引用
          </Badge>
        </div>
        <h1 className="text-lg leading-snug font-semibold">{title}</h1>
      </header>
      <section className="mt-6">
        <Button type="button" size="sm" onClick={() => selectCanvas(canvasId)}>
          <PanelsTopLeft size={14} />
          打开画布
        </Button>
      </section>
      <section className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        当前为线框跳转；v1 经带参跳转机制打开目标画布（待定，0.1）
      </section>
    </DetailArticle>
  );
}

function GroupDetailView({
  label,
  childrenElements,
}: {
  label: string;
  childrenElements: { id: string; kind: string }[];
}) {
  return (
    <DetailArticle>
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            <FolderTree size={11} />
            分组
          </Badge>
        </div>
        <h1 className="text-lg leading-snug font-semibold">{label}</h1>
      </header>
      <section className="mt-6 flex flex-col gap-2">
        <div className="text-sm font-medium">组内元素（{childrenElements.length}）</div>
        {childrenElements.map((child) => (
          <div key={child.id} className="rounded-lg border bg-card px-3 py-2 text-sm">
            {child.kind === "text" ? "文本" : child.kind === "shape" ? "形状" : child.kind}
          </div>
        ))}
      </section>
    </DetailArticle>
  );
}

function SimpleElementDetailView({
  kind,
  description,
  coordinate,
}: {
  kind: string;
  description: string;
  coordinate: string;
}) {
  return (
    <DetailArticle>
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            <FileText size={11} />
            {kind === "text" ? "文本" : kind === "shape" ? "形状" : kind}
          </Badge>
        </div>
        <h1 className="text-lg leading-snug font-semibold">{description || "未命名元素"}</h1>
      </header>
      <section className="mt-6 text-sm text-muted-foreground">{coordinate}</section>
    </DetailArticle>
  );
}

/** 素材库条目详情（与元素详情同骨架，数据来自素材库 mock） */
function LibraryItemDetail({ item }: { item: LibraryItem }) {
  switch (item.type) {
    case "understanding":
      return <UnderstandingDetailView view={WIREFRAME_UNDERSTANDINGS[item.id]} />;
    case "context": {
      const context = Object.values(WIREFRAME_CONTEXTS)
        .flat()
        .find((ctx) => ctx.id === item.id);
      if (!context) return <DetailEmpty />;
      const owner = WIREFRAME_UNDERSTANDINGS[context.understandingId];
      const MediumIcon = CONTEXT_BADGE_ICON[context.medium];
      return (
        <DetailArticle>
          <header className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                <MediumIcon size={11} />
                上下文
              </Badge>
            </div>
            <h1 className="text-lg leading-snug font-semibold">
              {context.title?.trim() || "未命名上下文"}
            </h1>
          </header>
          <section className="mt-4 text-sm text-muted-foreground">
            <SimpleMarkdownPreview value={context.content} />
          </section>
          <section className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            属于理解「{owner?.title ?? "未知"}」（v1 点击跳转）
          </section>
        </DetailArticle>
      );
    }
    case "domain": {
      const domain = WIREFRAME_DOMAINS.find((d) => d.id === item.id);
      return (
        <DetailArticle>
          <header className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                <FolderTree size={11} />
                领域
              </Badge>
            </div>
            <h1 className="text-lg leading-snug font-semibold">{domain?.name ?? item.title}</h1>
          </header>
          <section className="mt-6 text-xs text-muted-foreground">
            领域详情 v1 承接 Capture 领域树（此处为占位）
          </section>
        </DetailArticle>
      );
    }
    case "canvas": {
      const detail = WIREFRAME_CANVAS_DETAILS[item.id];
      return detail ? <CanvasSummaryView detail={detail} /> : <DetailEmpty />;
    }
  }
}

function CanvasSummaryView({ detail }: { detail: (typeof WIREFRAME_CANVAS_DETAILS)[string] }) {
  const selectCanvas = useCanvasWireframeStore((state) => state.selectCanvas);
  const createdLabel = formatDistanceToNow(new Date(detail.canvas.createdAt), {
    addSuffix: true,
    locale: zhCN,
  });
  const updatedLabel = formatDistanceToNow(new Date(detail.canvas.updatedAt), {
    addSuffix: true,
    locale: zhCN,
  });
  return (
    <DetailArticle>
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            <PanelsTopLeft size={11} />
            画布
          </Badge>
        </div>
        <h1 className="text-lg leading-snug font-semibold">{detail.canvas.title}</h1>
        {detail.canvas.description ? (
          <p className="text-sm text-muted-foreground">{detail.canvas.description}</p>
        ) : null}
      </header>
      <section className="mt-6 grid grid-cols-3 gap-2 text-center">
        <InfoCell label="元素" value={detail.elements.length} />
        <InfoCell label="连线" value={detail.edges.length} />
        <InfoCell label="引用理解" value={detail.understandingRefs.length} />
      </section>
      <section className="mt-6 space-y-1 text-xs text-muted-foreground">
        <div>创建于 {createdLabel}</div>
        <div>更新于 {updatedLabel}</div>
      </section>
      <section className="mt-6">
        <Button type="button" size="sm" onClick={() => selectCanvas(detail.canvas.id)}>
          <PanelsTopLeft size={14} />
          打开画布
        </Button>
      </section>
    </DetailArticle>
  );
}

function InfoCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card py-2.5">
      <div className="text-lg font-semibold text-foreground tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** 详情内容统一骨架：等宽正文 + 无滚动条滚动 */
function DetailArticle({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <article className="mx-auto max-w-xl px-5 py-4">{children}</article>
    </div>
  );
}
