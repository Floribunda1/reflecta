import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowLeft, Compass, GitBranch, Link2, Pencil, Sparkles } from "lucide-react";
import type { Domain } from "@shared/domain";
import type { ContextDTO } from "@shared/context";
import type { UnderstandingDTO, UnderstandingSummaryDTO } from "@shared/understanding";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Skeleton } from "@renderer/components/ui/skeleton";
import { ipcClient } from "@renderer/utils/ipc";
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
  pickWanderUnderstandingId,
  understandingTitle,
  UNASSIGNED_DOMAIN_ID,
  type DomainReviewSummary,
} from "./review-data";

// PROTOTYPE: Can content-first domain browsing plus one optional AI-selected next note
// make Contemplate feel useful without imposing a review method?
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visitedIds, setVisitedIds] = useState<string[]>([]);
  const summaries = buildDomainReviewSummaries(domainList, understandings ?? []);
  const selectedDomain =
    summaries.find((domain) => domain.id === selectedDomainId) ?? summaries[0] ?? null;
  const summaryById = new Map((understandings ?? []).map((item) => [item.id, item]));
  const activeUnderstanding = activeId ? (summaryById.get(activeId) ?? null) : null;

  const selectDomain = (domainId: string) => {
    setSelectedDomainId(domainId);
    setActiveId(null);
    setVisitedIds([]);
  };

  const openUnderstanding = (understandingId: string) => {
    setActiveId(understandingId);
    setVisitedIds((current) =>
      current.includes(understandingId) ? current : [...current, understandingId],
    );
  };

  const startWander = () => {
    if (!selectedDomain?.understandings.length) return;
    const index = Math.floor(Math.random() * selectedDomain.understandings.length);
    openUnderstanding(selectedDomain.understandings[index].id);
  };

  return (
    <div className="flex h-full min-w-0 bg-muted/15 pt-12">
      <DomainShelf
        summaries={summaries}
        selectedDomainId={selectedDomain?.id ?? null}
        loading={loading || !understandings}
        onSelect={selectDomain}
        onOpenMap={onOpenMap}
      />

      <main className="relative min-w-0 flex-1 bg-background">
        {activeUnderstanding && selectedDomain ? (
          <UnderstandingReader
            key={activeUnderstanding.id}
            understanding={activeUnderstanding}
            selectedDomain={selectedDomain}
            domains={domainList}
            allUnderstandings={understandings ?? []}
            visitedIds={visitedIds}
            onBack={() => setActiveId(null)}
            onOpenUnderstanding={openUnderstanding}
            onEdit={() => onEditUnderstanding(activeUnderstanding.id)}
          />
        ) : (
          <DomainContents
            domain={selectedDomain}
            domains={domainList}
            loading={loading || !understandings}
            onOpenUnderstanding={openUnderstanding}
            onStartWander={startWander}
          />
        )}
      </main>
    </div>
  );
}

function DomainShelf({
  summaries,
  selectedDomainId,
  loading,
  onSelect,
  onOpenMap,
}: {
  summaries: DomainReviewSummary[];
  selectedDomainId: string | null;
  loading: boolean;
  onSelect: (domainId: string) => void;
  onOpenMap: () => void;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/20">
      <div className="border-b px-5 pb-5 pt-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Compass size={17} />
          Contemplate
        </div>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          看看已经知道了什么，偶尔顺着它走远一点。
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2">
          {loading
            ? Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-11 rounded-lg" />
              ))
            : summaries.map((domain) => (
                <button
                  key={domain.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent",
                    selectedDomainId === domain.id && "bg-accent text-accent-foreground",
                  )}
                  onClick={() => onSelect(domain.id)}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{domain.name}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {domain.understandings.length}
                  </span>
                </button>
              ))}
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <Button type="button" variant="ghost" className="w-full justify-start" onClick={onOpenMap}>
          <GitBranch size={15} />
          知识图谱
        </Button>
      </div>
    </aside>
  );
}

function DomainContents({
  domain,
  domains,
  loading,
  onOpenUnderstanding,
  onStartWander,
}: {
  domain: DomainReviewSummary | null;
  domains: Domain[];
  loading: boolean;
  onOpenUnderstanding: (understandingId: string) => void;
  onStartWander: () => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 p-8 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-60 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        还没有可以浏览的 Understanding。
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-6 border-b px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{domain.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {domain.understandings.length} 条 Understanding
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onStartWander}>
          <Sparkles size={15} />
          随便走走
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-8 md:grid-cols-2 2xl:grid-cols-3">
          {domain.understandings.map((understanding) => (
            <UnderstandingCard
              key={understanding.id}
              understanding={understanding}
              domainPath={getDomainPath(understanding.domainIds[0], domains)}
              onOpen={() => onOpenUnderstanding(understanding.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function UnderstandingCard({
  understanding,
  domainPath,
  onOpen,
}: {
  understanding: UnderstandingSummaryDTO;
  domainPath: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="group flex min-h-60 flex-col rounded-xl border bg-card p-5 text-left transition-colors hover:border-foreground/20 hover:bg-accent/20 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      onClick={onOpen}
    >
      <div className="text-[11px] text-muted-foreground">{domainPath}</div>
      <h2 className="mt-3 line-clamp-3 text-base font-semibold leading-6">
        {understandingTitle(understanding)}
      </h2>
      <div className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
        {understanding.body.trim() ? (
          <SimpleMarkdownPreview content={understanding.body} lineClamp={6} />
        ) : (
          <span>这条 Understanding 还没有正文。</span>
        )}
      </div>
      <div className="mt-5 flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
        <span>{understanding.contextCount} Context</span>
        {understanding.connectionCount > 0 ? (
          <span>{understanding.connectionCount} Connection</span>
        ) : null}
      </div>
    </button>
  );
}

function UnderstandingReader({
  understanding,
  selectedDomain,
  domains,
  allUnderstandings,
  visitedIds,
  onBack,
  onOpenUnderstanding,
  onEdit,
}: {
  understanding: UnderstandingSummaryDTO;
  selectedDomain: DomainReviewSummary;
  domains: Domain[];
  allUnderstandings: UnderstandingSummaryDTO[];
  visitedIds: string[];
  onBack: () => void;
  onOpenUnderstanding: (understandingId: string) => void;
  onEdit: () => void;
}) {
  const { data: detail, isFetching } = useCaptureUnderstandingDetail(understanding.id);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex h-[73px] shrink-0 items-center justify-between gap-5 border-b px-5">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft size={15} />
          {selectedDomain.name}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
          <Pencil size={14} />
          编辑
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <article className="mx-auto w-full max-w-3xl px-8 pb-32 pt-10">
          <div className="text-xs text-muted-foreground">
            {getDomainPath(understanding.domainIds[0], domains)}
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight">
            {understandingTitle(understanding)}
          </h1>

          {isFetching || !detail ? (
            <div className="mt-8 space-y-4">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
            </div>
          ) : (
            <UnderstandingBody detail={detail} onOpenUnderstanding={onOpenUnderstanding} />
          )}
        </article>
      </ScrollArea>

      {detail ? (
        <WanderBar
          understanding={understanding}
          detail={detail}
          selectedDomain={selectedDomain}
          allUnderstandings={allUnderstandings}
          visitedIds={visitedIds}
          onOpenUnderstanding={onOpenUnderstanding}
        />
      ) : null}
    </div>
  );
}

function UnderstandingBody({
  detail,
  onOpenUnderstanding,
}: {
  detail: UnderstandingDTO;
  onOpenUnderstanding: (understandingId: string) => void;
}) {
  const { openDrawer } = useSharedDrawer();

  const openContext = (context: ContextDTO) => {
    openDrawer(
      {
        title: context.title?.trim() || "Context",
        widthClassName:
          "data-[side=right]:w-[min(760px,calc(100vw-2rem))] data-[side=right]:sm:max-w-none",
      },
      <ContextPreviewDrawerContent context={context} />,
    );
  };

  const connections = [...detail.connections, ...detail.referencedBy].filter(
    (item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index,
  );

  return (
    <div className="mt-8 space-y-10">
      <section className="text-[15px] leading-7">
        {detail.body.trim() ? (
          <MarkdownPreview content={detail.body} />
        ) : (
          <span className="text-muted-foreground">这条 Understanding 还没有正文。</span>
        )}
      </section>

      <div className="text-xs text-muted-foreground">
        {formatDistanceToNow(detail.updatedAt, { addSuffix: true, locale: zhCN })}更新
      </div>

      <section>
        <h2 className="text-sm font-semibold">Context</h2>
        {detail.contexts.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {detail.contexts.map((context) => (
              <ContextCard key={context.id} context={context} onOpen={() => openContext(context)} />
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            这条 Understanding 还没有保留 Context。
          </div>
        )}
      </section>

      {connections.length > 0 ? (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link2 size={14} />
            Connection
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {connections.map((connection) => (
              <Button
                key={connection.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-auto max-w-full whitespace-normal text-left"
                onClick={() => onOpenUnderstanding(connection.id)}
              >
                {understandingTitle(connection)}
              </Button>
            ))}
          </div>
        </section>
      ) : null}
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
        <SimpleMarkdownPreview content={context.content || "空 Context"} lineClamp={4} />
      </div>
    </button>
  );
}

function WanderBar({
  understanding,
  detail,
  selectedDomain,
  allUnderstandings,
  visitedIds,
  onOpenUnderstanding,
}: {
  understanding: UnderstandingSummaryDTO;
  detail: UnderstandingDTO;
  selectedDomain: DomainReviewSummary;
  allUnderstandings: UnderstandingSummaryDTO[];
  visitedIds: string[];
  onOpenUnderstanding: (understandingId: string) => void;
}) {
  const query = [
    understanding.title,
    detail.body,
    ...detail.contexts.map((context) => context.content),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2400);
  const anchors = [
    { type: "understanding" as const, id: understanding.id },
    ...(selectedDomain.id === UNASSIGNED_DOMAIN_ID
      ? []
      : [{ type: "domain" as const, id: selectedDomain.id }]),
  ];
  const { data, isFetching } = useQuery({
    queryKey: ["contemplate", "wander", understanding.id],
    queryFn: () => ipcClient.search.retrieveKnowledge({ query, anchors, limit: 10 }),
    enabled: Boolean(query),
    staleTime: 60_000,
  });
  const summaryById = new Map(allUnderstandings.map((item) => [item.id, item]));
  const candidateId = pickWanderUnderstandingId({
    retrievedIds: (data?.candidates ?? []).map((candidate) => candidate.id),
    fallbackIds: selectedDomain.understandings.map((item) => item.id),
    currentId: understanding.id,
    visitedIds,
  });
  const candidate = candidateId ? (summaryById.get(candidateId) ?? null) : null;
  const retrievedCandidate = data?.candidates.find((item) => item.id === candidateId);
  const isSuggested = Boolean(
    retrievedCandidate?.evidence.some(
      (evidence) => evidence.channel === "dense" || evidence.channel === "lexical",
    ),
  );

  return (
    <div className="absolute bottom-6 left-1/2 z-10 w-[min(680px,calc(100%-3rem))] -translate-x-1/2">
      <div className="flex items-center gap-4 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground">
            {isFetching ? "正在寻找下一条…" : isSuggested ? "可能相关" : "继续逛这个领域"}
          </div>
          <div className="mt-0.5 truncate text-sm font-medium">
            {candidate ? understandingTitle(candidate) : "暂时没有别的 Understanding"}
          </div>
        </div>
        <Button
          type="button"
          disabled={!candidate || isFetching}
          onClick={() => candidate && onOpenUnderstanding(candidate.id)}
        >
          Wander
          <Compass size={15} />
        </Button>
      </div>
    </div>
  );
}
