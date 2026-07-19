import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  GitBranch,
  History,
  Link2,
  Pencil,
  RotateCcw,
} from "lucide-react";
import type { Domain } from "@shared/domain";
import type { ContextDTO } from "@shared/context";
import type { UnderstandingDTO, UnderstandingSummaryDTO } from "@shared/understanding";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@renderer/components/ui/card";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Skeleton } from "@renderer/components/ui/skeleton";
import { Textarea } from "@renderer/components/ui/textarea";
import {
  MarkdownPreview,
  SimpleMarkdownPreview,
} from "@renderer/modules/shared/components/markdown-editor/preview";
import { useSharedDrawer } from "@renderer/modules/shared/hooks/use-drawer";
import { ContextPreviewDrawerContent } from "@renderer/modules/capture/understanding-detail";
import { CONTEXT_META } from "@renderer/modules/capture/understanding-detail/context/types";
import {
  useCaptureDomains,
  useCaptureUnderstandingDetail,
} from "@renderer/modules/capture/queries";
import { cn } from "@renderer/lib/utils";
import { useUnderstandingsQuery } from "./graph/useUnderstandingsQuery";
import {
  buildDomainReviewSummaries,
  getDomainPath,
  understandingTitle,
  type DomainReviewSummary,
} from "./review-data";

type ReviewState = "clear" | "unclear" | "changed";

const REVIEW_STATE_META: Record<ReviewState, { label: string; Icon: typeof Check }> = {
  clear: { label: "表达清楚", Icon: Check },
  unclear: { label: "还说不清", Icon: CircleHelp },
  changed: { label: "判断已变化", Icon: RotateCcw },
};

export function ReviewWorkspace({
  onOpenMap,
  onEditUnderstanding,
}: {
  onOpenMap: () => void;
  onEditUnderstanding: (understandingId: string) => void;
}) {
  const { data: understandings } = useUnderstandingsQuery([], true);
  const { domainList, loading } = useCaptureDomains();
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const summaries = buildDomainReviewSummaries(domainList, understandings ?? []);
  const selectedDomain = summaries.find((domain) => domain.id === selectedDomainId) ?? null;

  return (
    <div className="flex h-full min-w-0 flex-col bg-muted/20 pt-12">
      {selectedDomain ? (
        <DomainReview
          key={selectedDomain.id}
          domain={selectedDomain}
          domains={domainList}
          onBack={() => setSelectedDomainId(null)}
          onOpenMap={onOpenMap}
          onEditUnderstanding={onEditUnderstanding}
        />
      ) : (
        <DomainOverview
          summaries={summaries}
          loading={loading || !understandings}
          onSelectDomain={setSelectedDomainId}
          onOpenMap={onOpenMap}
        />
      )}
    </div>
  );
}

function DomainOverview({
  summaries,
  loading,
  onSelectDomain,
  onOpenMap,
}: {
  summaries: DomainReviewSummary[];
  loading: boolean;
  onSelectDomain: (domainId: string) => void;
  onOpenMap: () => void;
}) {
  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-6 border-b bg-background px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">领域回顾</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            看看每个领域已经形成了哪些理解，再选择一个领域重新走一遍。
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onOpenMap}>
          <GitBranch size={15} />
          知识图谱
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <main className="mx-auto w-full max-w-7xl px-8 py-8">
          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-72 rounded-xl" />
              ))}
            </div>
          ) : summaries.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {summaries.map((domain) => (
                <DomainCard key={domain.id} domain={domain} onSelect={onSelectDomain} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-80 items-center justify-center rounded-xl border border-dashed bg-background text-sm text-muted-foreground">
              还没有可以回顾的 Understanding。
            </div>
          )}
        </main>
      </ScrollArea>
    </>
  );
}

function DomainCard({
  domain,
  onSelect,
}: {
  domain: DomainReviewSummary;
  onSelect: (domainId: string) => void;
}) {
  const contextCount = domain.understandings.reduce(
    (sum, understanding) => sum + understanding.contextCount,
    0,
  );

  return (
    <Card className="min-h-72 transition-shadow hover:shadow-md">
      <CardHeader className="border-b">
        <CardTitle>{domain.name}</CardTitle>
        <CardDescription>
          {domain.understandings.length} 条理解 · {contextCount} 个 Context
        </CardDescription>
        <CardAction>
          <BookOpen size={17} className="text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {domain.understandings.slice(0, 4).map((understanding) => (
          <div key={understanding.id} className="flex items-start gap-2 text-sm">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/65" />
            <span className="line-clamp-2 leading-5">{understandingTitle(understanding)}</span>
          </div>
        ))}
        {domain.understandings.length > 4 ? (
          <div className="text-xs text-muted-foreground">
            还有 {domain.understandings.length - 4} 条理解
          </div>
        ) : null}
      </CardContent>
      <div className="px-6">
        <Button type="button" className="w-full" onClick={() => onSelect(domain.id)}>
          开始回顾
          <ChevronRight size={15} />
        </Button>
      </div>
    </Card>
  );
}

function DomainReview({
  domain,
  domains,
  onBack,
  onOpenMap,
  onEditUnderstanding,
}: {
  domain: DomainReviewSummary;
  domains: Domain[];
  onBack: () => void;
  onOpenMap: () => void;
  onEditUnderstanding: (understandingId: string) => void;
}) {
  const [activeId, setActiveId] = useState(domain.understandings[0]?.id ?? "");
  const [trail, setTrail] = useState<string[]>(activeId ? [activeId] : []);
  const [reviewStates, setReviewStates] = useState<Record<string, ReviewState>>({});
  const activeIndex = domain.understandings.findIndex((item) => item.id === activeId);
  const activeUnderstanding = domain.understandings[activeIndex];

  const selectUnderstanding = (understandingId: string) => {
    setActiveId(understandingId);
    setTrail((current) =>
      current[current.length - 1] === understandingId ? current : [...current, understandingId],
    );
  };

  return (
    <>
      <header className="flex h-[73px] shrink-0 items-center justify-between gap-6 border-b bg-background px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="返回领域总览"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{domain.name}</h1>
            <p className="text-xs text-muted-foreground">
              {domain.understandings.length} 条理解 · 本次已回顾 {Object.keys(reviewStates).length}{" "}
              条
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={onOpenMap}>
          <GitBranch size={15} />
          查看图谱
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(460px,1fr)_300px]">
        <UnderstandingOutline
          understandings={domain.understandings}
          domains={domains}
          activeId={activeId}
          reviewStates={reviewStates}
          onSelect={selectUnderstanding}
        />

        <main className="min-w-0 border-x bg-background">
          {activeUnderstanding ? (
            <ReviewCard
              key={activeId}
              understanding={activeUnderstanding}
              domains={domains}
              currentIndex={activeIndex}
              total={domain.understandings.length}
              reviewState={reviewStates[activeId]}
              onReviewState={(state) =>
                setReviewStates((current) => ({ ...current, [activeId]: state }))
              }
              onEdit={() => onEditUnderstanding(activeId)}
              onPrevious={
                activeIndex > 0
                  ? () => selectUnderstanding(domain.understandings[activeIndex - 1].id)
                  : undefined
              }
              onNext={
                activeIndex >= 0 && activeIndex < domain.understandings.length - 1
                  ? () => selectUnderstanding(domain.understandings[activeIndex + 1].id)
                  : undefined
              }
            />
          ) : null}
        </main>

        {activeUnderstanding ? (
          <WanderPanel
            activeId={activeId}
            domainUnderstandings={domain.understandings}
            trail={trail}
            onSelect={selectUnderstanding}
          />
        ) : null}
      </div>
    </>
  );
}

function UnderstandingOutline({
  understandings,
  domains,
  activeId,
  reviewStates,
  onSelect,
}: {
  understandings: UnderstandingSummaryDTO[];
  domains: Domain[];
  activeId: string;
  reviewStates: Record<string, ReviewState>;
  onSelect: (understandingId: string) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col bg-muted/20">
      <div className="border-b px-4 py-4">
        <div className="text-sm font-medium">理解轮廓</div>
        <div className="mt-1 text-xs text-muted-foreground">选择一条，先尝试自己讲清楚。</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-2">
          {understandings.map((understanding) => {
            const state = reviewStates[understanding.id];
            const StateIcon = state ? REVIEW_STATE_META[state].Icon : null;
            return (
              <button
                key={understanding.id}
                type="button"
                className={cn(
                  "rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent",
                  activeId === understanding.id && "bg-accent text-accent-foreground",
                )}
                onClick={() => onSelect(understanding.id)}
              >
                <div className="flex items-start gap-2">
                  {StateIcon ? (
                    <StateIcon size={14} className="mt-0.5 shrink-0 text-primary" />
                  ) : (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  )}
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-sm font-medium leading-5">
                      {understandingTitle(understanding)}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">
                      {getDomainPath(understanding.domainIds[0], domains)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

function ReviewCard({
  understanding,
  domains,
  currentIndex,
  total,
  reviewState,
  onReviewState,
  onEdit,
  onPrevious,
  onNext,
}: {
  understanding: UnderstandingSummaryDTO;
  domains: Domain[];
  currentIndex: number;
  total: number;
  reviewState?: ReviewState;
  onReviewState: (state: ReviewState) => void;
  onEdit: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const [recall, setRecall] = useState("");
  const [revealed, setRevealed] = useState(false);
  const { data: detail, isFetching } = useCaptureUnderstandingDetail(understanding.id);

  return (
    <ScrollArea className="h-full">
      <article className="mx-auto w-full max-w-3xl px-8 py-7">
        <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="outline">
              {currentIndex + 1} / {total}
            </Badge>
            <span className="truncate">{getDomainPath(understanding.domainIds[0], domains)}</span>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
            <Pencil size={14} />
            编辑原理解
          </Button>
        </div>

        <h2 className="mt-6 text-2xl font-semibold leading-9 tracking-tight">
          {understandingTitle(understanding)}
        </h2>

        {!revealed ? (
          <section className="mt-8 rounded-xl border bg-muted/20 p-6">
            <div className="text-base font-medium">先别看原文，你会怎样解释这条理解？</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              不需要写得完整。试着把当时的判断、适用边界或一个例子重新说出来。
            </p>
            <Textarea
              autoFocus
              value={recall}
              onChange={(event) => setRecall(event.target.value)}
              className="mt-5 min-h-40 resize-none bg-background leading-6"
              placeholder="用现在的语言复述一下……"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRevealed(true)}>
                暂时说不出来
              </Button>
              <Button type="button" onClick={() => setRevealed(true)}>
                查看原理解与 Context
                <ChevronRight size={15} />
              </Button>
            </div>
          </section>
        ) : (
          <RevealedUnderstanding
            recall={recall}
            detail={detail ?? null}
            loading={isFetching}
            reviewState={reviewState}
            onReviewState={onReviewState}
          />
        )}

        <footer className="mt-8 flex items-center justify-between border-t pt-5">
          <Button type="button" variant="outline" disabled={!onPrevious} onClick={onPrevious}>
            <ChevronLeft size={15} />
            上一条
          </Button>
          <Button type="button" variant="outline" disabled={!onNext} onClick={onNext}>
            下一条
            <ChevronRight size={15} />
          </Button>
        </footer>
      </article>
    </ScrollArea>
  );
}

function RevealedUnderstanding({
  recall,
  detail,
  loading,
  reviewState,
  onReviewState,
}: {
  recall: string;
  detail: UnderstandingDTO | null;
  loading: boolean;
  reviewState?: ReviewState;
  onReviewState: (state: ReviewState) => void;
}) {
  const { openDrawer } = useSharedDrawer();

  if (loading || !detail) {
    return <Skeleton className="mt-8 h-96 rounded-xl" />;
  }

  const openContext = (context: ContextDTO) => {
    openDrawer(
      {
        title: "回到当时的场景",
        widthClassName:
          "data-[side=right]:w-[min(760px,calc(100vw-2rem))] data-[side=right]:sm:max-w-none",
      },
      <ContextPreviewDrawerContent context={context} />,
    );
  };

  return (
    <div className="mt-8 space-y-7">
      {recall.trim() ? (
        <section>
          <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">
            我的复述
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
            {recall.trim()}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-xs font-medium tracking-wide text-muted-foreground">原理解</div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(detail.updatedAt, { addSuffix: true, locale: zhCN })}
          </span>
        </div>
        <div className="rounded-xl border bg-card px-5 py-4">
          {detail.body.trim() ? (
            <MarkdownPreview content={detail.body} />
          ) : (
            <span className="text-sm text-muted-foreground">这条理解还没有正文。</span>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <div className="text-sm font-medium">当时的 Context</div>
          <p className="mt-1 text-xs text-muted-foreground">从形成理解的场景重新进入当时的心智。</p>
        </div>
        {detail.contexts.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {detail.contexts.map((context) => (
              <ContextCard key={context.id} context={context} onOpen={() => openContext(context)} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            这条理解还没有保留形成它的 Context。
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-muted/20 p-5">
        <div className="text-sm font-medium">现在再看，你能把它说清楚吗？</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            Object.entries(REVIEW_STATE_META) as Array<
              [ReviewState, (typeof REVIEW_STATE_META)[ReviewState]]
            >
          ).map(([state, meta]) => {
            const Icon = meta.Icon;
            return (
              <Button
                key={state}
                type="button"
                size="sm"
                variant={reviewState === state ? "default" : "outline"}
                onClick={() => onReviewState(state)}
              >
                <Icon size={14} />
                {meta.label}
              </Button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">只记录本次回顾感受，不计算掌握度。</p>
      </section>
    </div>
  );
}

function ContextCard({ context, onOpen }: { context: ContextDTO; onOpen: () => void }) {
  const meta = CONTEXT_META[context.medium];
  const Icon = meta.Icon;

  return (
    <button
      type="button"
      className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      onClick={onOpen}
    >
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <Icon size={11} />
          {meta.label}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {context.title?.trim() || meta.label}
        </span>
      </div>
      <div className="mt-3 text-sm leading-5 text-muted-foreground">
        <SimpleMarkdownPreview content={context.content || "空 Context"} lineClamp={3} />
      </div>
    </button>
  );
}

function WanderPanel({
  activeId,
  domainUnderstandings,
  trail,
  onSelect,
}: {
  activeId: string;
  domainUnderstandings: UnderstandingSummaryDTO[];
  trail: string[];
  onSelect: (understandingId: string) => void;
}) {
  const { data: detail } = useCaptureUnderstandingDetail(activeId);
  const inDomain = new Set(domainUnderstandings.map((understanding) => understanding.id));
  const summaryById = new Map(
    domainUnderstandings.map((understanding) => [understanding.id, understanding]),
  );
  const related = detail
    ? [...detail.connections, ...detail.referencedBy].filter((item, index, items) => {
        return (
          inDomain.has(item.id) &&
          items.findIndex((candidate) => candidate.id === item.id) === index
        );
      })
    : [];

  return (
    <aside className="flex min-h-0 flex-col bg-muted/20">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-7 p-4">
          <section>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 size={15} />
              顺着关系继续
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              只显示这个领域内已经确认的 Connection。
            </p>
            <div className="mt-3 space-y-1">
              {related.length > 0 ? (
                related.map((understanding) => (
                  <button
                    key={understanding.id}
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm leading-5 transition-colors hover:bg-accent"
                    onClick={() => onSelect(understanding.id)}
                  >
                    {understandingTitle(understanding)}
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed px-3 py-5 text-center text-xs leading-5 text-muted-foreground">
                  这条理解在当前领域还是一座孤岛。
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 text-sm font-medium">
              <History size={15} />
              本次回顾轨迹
            </div>
            <div className="mt-3 space-y-1 border-l pl-3">
              {trail.map((id, index) => {
                const understanding = summaryById.get(id);
                if (!understanding) return null;
                return (
                  <button
                    key={`${id}:${index}`}
                    type="button"
                    className={cn(
                      "block w-full rounded-md px-2 py-1.5 text-left text-xs leading-5 text-muted-foreground hover:bg-accent hover:text-foreground",
                      id === activeId && "bg-accent text-foreground",
                    )}
                    onClick={() => onSelect(id)}
                  >
                    {understandingTitle(understanding)}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}
