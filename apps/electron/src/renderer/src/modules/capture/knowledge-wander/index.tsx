import { Network, Share2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@renderer/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@renderer/components/ui/resizable";
import { Skeleton } from "@renderer/components/ui/skeleton";
import { cn } from "@renderer/lib/utils";
import { SidebarToggleButton } from "@renderer/modules/shared/layout/SidebarToggleButton";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { useCaptureDomains, useCaptureUnderstandingList } from "../queries";
import { useCaptureStore, type CaptureAgentScope } from "../store";
import { UnderstandingDetail } from "../understanding-detail";
import { buildKnowledgeGraphData } from "./graph-data";
import { KnowledgeGraph } from "./graph";

const EMPTY_UNDERSTANDINGS: UnderstandingSummaryDTO[] = [];

export function KnowledgeWanderWorkspace({
  onChat,
  onExpandSidebar,
}: {
  onChat?: (scope: CaptureAgentScope) => void;
  onExpandSidebar?: () => void;
}) {
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const selectedUnderstandingId = useCaptureStore((state) => state.selectedUnderstandingId);
  const selectDomain = useCaptureStore((state) => state.selectDomain);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const toggleKnowledgeWander = useCaptureStore((state) => state.toggleKnowledgeWander);
  const setSearchOpen = useCaptureStore((state) => state.setSearchOpen);
  const resetAfterUnderstandingDeleted = useCaptureStore(
    (state) => state.resetAfterUnderstandingDeleted,
  );
  const { domainList } = useCaptureDomains();
  const { data, isPending, isError } = useCaptureUnderstandingList({
    selectedDomainId,
    includeDescendants: true,
    searchQuery: "",
  });
  const understandings = data ?? EMPTY_UNDERSTANDINGS;
  const graphData = useMemo(() => buildKnowledgeGraphData(understandings), [understandings]);
  const scopeTitle =
    selectedDomainId === "all"
      ? "全部领域"
      : (domainList.find(({ id }) => id === selectedDomainId)?.name ?? "当前领域");

  const handleWikiLinkClick = (understandingId: string) => {
    selectDomain("all");
    setSearchOpen(false);
    selectUnderstanding(understandingId);
  };

  let graphContent: React.ReactNode;
  if (isPending) {
    graphContent = (
      <div className="grid h-full grid-cols-6 items-center gap-8 px-12">
        {Array.from({ length: 18 }, (_, index) => (
          <Skeleton
            // The staggered sizes suggest a graph without predefining its final layout.
            key={index}
            className="mx-auto size-2 rounded-full"
            style={{ opacity: 0.25 + (index % 4) * 0.12 }}
          />
        ))}
      </div>
    );
  } else if (isError) {
    graphContent = (
      <Empty className="h-full">
        <EmptyContent>
          <EmptyMedia variant="icon">
            <Network />
          </EmptyMedia>
          <EmptyDescription>图谱加载失败，请稍后重试</EmptyDescription>
        </EmptyContent>
      </Empty>
    );
  } else if (graphData.nodes.length === 0) {
    graphContent = (
      <Empty className="h-full">
        <EmptyContent>
          <EmptyMedia variant="icon">
            <Network />
          </EmptyMedia>
          <EmptyDescription>这个领域还没有理解</EmptyDescription>
        </EmptyContent>
      </Empty>
    );
  } else {
    graphContent = (
      <KnowledgeGraph
        data={graphData}
        selectedUnderstandingId={selectedUnderstandingId}
        onSelect={selectUnderstanding}
        onClearSelection={() => selectUnderstanding(null)}
      />
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 min-w-0 bg-background">
      <ResizablePanel
        id="knowledge-wander-graph-panel"
        minSize={selectedUnderstandingId ? "44%" : "100%"}
        defaultSize={selectedUnderstandingId ? "60%" : "100%"}
        className="min-h-0 min-w-0"
      >
        <main className="flex h-full min-h-0 min-w-0 flex-col bg-background">
          <header
            data-testid="knowledge-wander-header"
            className={cn(
              "flex h-14 shrink-0 items-center gap-1 border-b bg-background/90 px-5 backdrop-blur-sm",
              onExpandSidebar && "pl-[86px]",
            )}
          >
            {onExpandSidebar ? (
              <SidebarToggleButton
                expanded={false}
                label="展开 Domain Tree"
                testId="capture-sidebar-expand-button"
                onClick={onExpandSidebar}
              />
            ) : null}
            <div className="app-drag-region min-w-0">
              <div className="truncate text-sm font-medium">{scopeTitle}</div>
              <div className="text-xs text-muted-foreground">{graphData.nodes.length} 条理解</div>
            </div>
            <div className="app-drag-region min-w-0 flex-1 self-stretch" />
            <div
              data-testid="knowledge-wander-actions"
              className="flex shrink-0 items-center"
              data-no-drag
            >
              <Button
                data-testid="capture-knowledge-wander-entry"
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="退出知识漫步"
                aria-pressed={true}
                className="bg-muted text-foreground"
                onClick={toggleKnowledgeWander}
              >
                <Share2 size={14} />
              </Button>
            </div>
          </header>
          <div className="min-h-0 min-w-0 flex-1">{graphContent}</div>
        </main>
      </ResizablePanel>

      {selectedUnderstandingId ? (
        <>
          <ResizableHandle
            withHandle
            className="w-3 cursor-col-resize bg-transparent after:w-px after:bg-border/50 hover:after:bg-border data-[resize-handle-active]:after:bg-ring [&>div]:h-10 [&>div]:w-0.5 [&>div]:bg-border/70"
          />
          <ResizablePanel
            id="knowledge-wander-detail-panel"
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
