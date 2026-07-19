import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import { Skeleton } from "@renderer/components/ui/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@renderer/components/ui/resizable";
import { UnderstandingDetail } from "../understanding-detail";
import { getDomainPath } from "../domain/util";
import { useCaptureDomains, useCaptureUnderstandingList } from "../queries";
import { useCaptureStore, type CaptureAgentScope } from "../store";
import { sortUnderstandingSummaries } from "../understanding-list/sort";
import { BookOpen, CircleAlert } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { KnowledgeWanderHeader } from "./header";
import { buildKnowledgeGraphData } from "./graph-data";
import { KnowledgeGraph } from "./graph";
import { KnowledgeWaterfall } from "./waterfall";

function WanderLoading() {
  return (
    <div className="grid h-full auto-rows-max grid-cols-2 gap-5 bg-muted/35 p-5">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <Skeleton key={item} className="h-48" />
      ))}
    </div>
  );
}

function WanderEmpty({ failed }: { failed: boolean }) {
  return (
    <Empty className="h-full bg-muted/35">
      <EmptyContent>
        <EmptyMedia variant="icon">{failed ? <CircleAlert /> : <BookOpen />}</EmptyMedia>
        <EmptyDescription>
          {failed ? "理解加载失败，请稍后重试" : "这个领域还没有理解"}
        </EmptyDescription>
      </EmptyContent>
    </Empty>
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
  const wanderView = useCaptureStore((state) => state.wanderView);
  const setWanderView = useCaptureStore((state) => state.setWanderView);
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
  const [graphVisited, setGraphVisited] = useState(wanderView === "graph");
  const understandings = useMemo(
    () => sortUnderstandingSummaries(data ?? [], sortBy),
    [data, sortBy],
  );
  const graphData = useMemo(() => buildKnowledgeGraphData(understandings), [understandings]);
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

  const handleViewChange = (view: typeof wanderView) => {
    if (view === "graph") setGraphVisited(true);
    setWanderView(view);
  };

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
    <div className="relative h-full min-h-0">
      <div
        aria-hidden={wanderView !== "waterfall"}
        className={`absolute inset-0 ${wanderView === "waterfall" ? "visible" : "invisible pointer-events-none"}`}
      >
        <KnowledgeWaterfall
          understandings={understandings}
          selectedUnderstandingId={selectedUnderstandingId}
          scopeKey={selectedDomainId}
          getDomainLabel={getDomainLabel}
          onSelect={selectUnderstanding}
        />
      </div>
      {graphVisited ? (
        <div
          aria-hidden={wanderView !== "graph"}
          className={`absolute inset-0 ${wanderView === "graph" ? "visible" : "invisible pointer-events-none"}`}
        >
          <KnowledgeGraph
            data={graphData}
            selectedUnderstandingId={selectedUnderstandingId}
            onSelect={selectUnderstanding}
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 min-w-0">
      <ResizablePanel
        id="knowledge-wander-surface"
        minSize={selectedUnderstandingId ? "44%" : "100%"}
        defaultSize={selectedUnderstandingId ? "60%" : "100%"}
        className="min-h-0 min-w-0"
      >
        <div className="flex h-full min-h-0 flex-col">
          <KnowledgeWanderHeader
            scopeTitle={scopeTitle}
            count={understandings.length}
            view={wanderView}
            onViewChange={handleViewChange}
          />
          <div className="min-h-0 flex-1">{content}</div>
        </div>
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
