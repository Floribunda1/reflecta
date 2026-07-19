import { useVirtualizer } from "@tanstack/react-virtual";
import { BookOpenText, CircleAlert, FileText, Link2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { Button } from "@renderer/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@renderer/components/ui/resizable";
import { Skeleton } from "@renderer/components/ui/skeleton";
import { cn } from "@renderer/lib/utils";
import { MarkdownPreview } from "@renderer/modules/shared/components/markdown-editor/preview";
import { getDomainPath } from "../domain/util";
import { useCaptureDomains, useCaptureUnderstandingList } from "../queries";
import { useCaptureStore, type CaptureAgentScope } from "../store";
import { UnderstandingDetail } from "../understanding-detail";
import { sortUnderstandingSummaries } from "../understanding-list/sort";
import { getUnderstandingTitle } from "../understanding-title";

function WanderLoading() {
  return (
    <div className="space-y-0 px-5">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="grid grid-cols-[minmax(180px,260px)_minmax(0,1fr)] gap-6 border-b py-7"
        >
          <Skeleton className="h-20" />
          <Skeleton className="h-48" />
        </div>
      ))}
    </div>
  );
}

function WanderEmpty({ failed }: { failed: boolean }) {
  return (
    <Empty className="h-full">
      <EmptyContent>
        <EmptyMedia variant="icon">{failed ? <CircleAlert /> : <BookOpenText />}</EmptyMedia>
        <EmptyDescription>
          {failed ? "理解加载失败，请稍后重试" : "这个领域还没有理解"}
        </EmptyDescription>
      </EmptyContent>
    </Empty>
  );
}

function UnderstandingReadingSection({
  understanding,
  domainLabel,
  selected,
  onSelect,
}: {
  understanding: UnderstandingSummaryDTO;
  domainLabel: string | null;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const title = getUnderstandingTitle(understanding);
  const updatedLabel = formatDistanceToNow(understanding.updatedAt, {
    addSuffix: true,
    locale: zhCN,
  });

  return (
    <article
      data-testid="knowledge-wander-section"
      data-understanding-id={understanding.id}
      data-understanding-title={title}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative grid grid-cols-[minmax(180px,260px)_minmax(0,1fr)] gap-6 border-b px-1 py-7 transition-colors hover:bg-muted/20 @max-[760px]:grid-cols-1 @max-[760px]:gap-4",
        selected && "bg-muted/25 hover:bg-muted/25",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-6 left-0 w-0.5 rounded-full bg-transparent",
          selected && "bg-primary",
        )}
      />

      <div className="flex min-w-0 flex-col items-start gap-3 pl-4">
        <Button
          type="button"
          variant="link"
          className="h-auto min-w-0 justify-start p-0 text-left text-base leading-snug font-semibold whitespace-normal text-foreground"
          aria-label={`打开理解：${title}`}
          onClick={() => onSelect(understanding.id)}
        >
          {title}
        </Button>

        {domainLabel ? (
          <div className="w-full truncate text-xs text-muted-foreground">{domainLabel}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span
            className="inline-flex items-center gap-1"
            aria-label={`${understanding.contextCount} 个上下文`}
          >
            <FileText size={13} aria-hidden />
            {understanding.contextCount}
          </span>
          <span
            className="inline-flex items-center gap-1"
            aria-label={`${understanding.connectionCount} 个双链关系`}
          >
            <Link2 size={13} aria-hidden />
            {understanding.connectionCount}
          </span>
          <span className="basis-full">{updatedLabel}</span>
        </div>
      </div>

      <div className="min-w-0 pr-4 @max-[760px]:pl-4">
        {understanding.body ? (
          <MarkdownPreview content={understanding.body} />
        ) : (
          <div className="text-sm text-muted-foreground">空理解，可以直接开始写。</div>
        )}
      </div>
    </article>
  );
}

function ReadingViewport({
  understandings,
  selectedUnderstandingId,
  scopeKey,
  getDomainLabel,
  onSelect,
}: {
  understandings: UnderstandingSummaryDTO[];
  selectedUnderstandingId: string | null;
  scopeKey: string;
  getDomainLabel: (understanding: UnderstandingSummaryDTO) => string | null;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopBeforeDetailRef = useRef<number | null>(null);
  const previousSelectionRef = useRef(selectedUnderstandingId);
  const virtualizer = useVirtualizer({
    count: understandings.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 360,
    getItemKey: (index) => understandings[index]?.id ?? index,
    overscan: 2,
  });

  useEffect(() => {
    virtualizer.scrollToOffset(0);
  }, [scopeKey, virtualizer]);

  useEffect(() => {
    const previousSelection = previousSelectionRef.current;
    previousSelectionRef.current = selectedUnderstandingId;
    if (!previousSelection || selectedUnderstandingId || scrollTopBeforeDetailRef.current == null)
      return;

    const scrollTop = scrollTopBeforeDetailRef.current;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollTop }),
      );
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [selectedUnderstandingId]);

  const handleSelect = (understandingId: string) => {
    scrollTopBeforeDetailRef.current = scrollRef.current?.scrollTop ?? 0;
    onSelect(understandingId);
  };

  return (
    <div
      ref={scrollRef}
      data-testid="knowledge-wander-reader"
      className="@container h-full overflow-y-auto bg-background px-5"
    >
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const understanding = understandings[virtualRow.index];
          if (!understanding) return null;

          return (
            <div
              key={understanding.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <UnderstandingReadingSection
                understanding={understanding}
                domainLabel={getDomainLabel(understanding)}
                selected={understanding.id === selectedUnderstandingId}
                onSelect={handleSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KnowledgeWanderWorkspace({
  onChat,
}: {
  onChat: (scope: CaptureAgentScope) => void;
}) {
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const selectedUnderstandingId = useCaptureStore((state) => state.selectedUnderstandingId);
  const sortBy = useCaptureStore((state) => state.understandingListSortBy);
  const selectDomain = useCaptureStore((state) => state.selectDomain);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const setSearchOpen = useCaptureStore((state) => state.setSearchOpen);
  const resetAfterUnderstandingDeleted = useCaptureStore(
    (state) => state.resetAfterUnderstandingDeleted,
  );
  const { domains, domainList } = useCaptureDomains();
  const { data, isPending, isError } = useCaptureUnderstandingList({
    selectedDomainId,
    includeDescendants: true,
    searchQuery: "",
  });
  const understandings = useMemo(
    () => sortUnderstandingSummaries(data ?? [], sortBy),
    [data, sortBy],
  );
  const scopeTitle =
    selectedDomainId === "all"
      ? "全部领域"
      : (domainList.find(({ id }) => id === selectedDomainId)?.name ?? "当前领域");

  const getDomainLabel = useCallback(
    (understanding: UnderstandingSummaryDTO) => {
      if (selectedDomainId !== "all") return null;
      const paths = understanding.domainIds
        .map((domainId) => getDomainPath(domainId, domains))
        .sort((left, right) => left.localeCompare(right));
      return paths.length > 0 ? paths.join(" · ") : "未归入领域";
    },
    [domains, selectedDomainId],
  );

  const handleWikiLinkClick = (understandingId: string) => {
    selectDomain("all");
    setSearchOpen(false);
    selectUnderstanding(understandingId);
  };

  const content = isPending ? (
    <WanderLoading />
  ) : isError || understandings.length === 0 ? (
    <WanderEmpty failed={isError} />
  ) : (
    <ReadingViewport
      understandings={understandings}
      selectedUnderstandingId={selectedUnderstandingId}
      scopeKey={selectedDomainId}
      getDomainLabel={getDomainLabel}
      onSelect={selectUnderstanding}
    />
  );

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 min-w-0">
      <ResizablePanel
        id="knowledge-wander-surface"
        minSize={selectedUnderstandingId ? "44%" : "100%"}
        defaultSize={selectedUnderstandingId ? "60%" : "100%"}
        className="min-h-0 min-w-0"
      >
        <main className="flex h-full min-h-0 flex-col bg-background">
          <header
            data-testid="knowledge-wander-header"
            className="app-drag-region flex h-14 shrink-0 items-center border-b bg-background/95 px-5 backdrop-blur-sm"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{scopeTitle}</div>
              <div className="text-xs text-muted-foreground">{understandings.length} 条理解</div>
            </div>
          </header>
          <div className="min-h-0 flex-1">{content}</div>
        </main>
      </ResizablePanel>

      {selectedUnderstandingId ? (
        <>
          <ResizableHandle
            withHandle
            className="w-3 cursor-col-resize bg-transparent after:w-px after:bg-border/50 hover:after:bg-border data-[resize-handle-active]:after:bg-ring [&>div]:h-10 [&>div]:w-0.5 [&>div]:bg-border/70"
          />
          <ResizablePanel
            id="knowledge-wander-detail"
            minSize="34%"
            defaultSize="40%"
            maxSize="56%"
            className="min-h-0 min-w-0 bg-background"
          >
            <UnderstandingDetail
              understandingId={selectedUnderstandingId}
              onClose={() => selectUnderstanding(null)}
              onWikiLinkClick={handleWikiLinkClick}
              onChat={onChat}
              onDeleted={() => resetAfterUnderstandingDeleted(selectedUnderstandingId)}
            />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  );
}
