import { FileText } from "lucide-react";
import { lazy, Suspense } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@renderer/components/ui/resizable";
import { ContextualAgentDock } from "@renderer/modules/chat/contextual-agent-dock";
import { DomainTree } from "./domain";
import { UnderstandingDetail } from "./understanding-detail";
import { UnderstandingList } from "./understanding-list";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import { Skeleton } from "@renderer/components/ui/skeleton";
import { useCaptureStore } from "./store";

const KnowledgeWanderWorkspace = lazy(() =>
  import("./knowledge-wander").then((module) => ({ default: module.KnowledgeWanderWorkspace })),
);

function CaptureAgentDock() {
  const agentDockScope = useCaptureStore((state) => state.agentDockScope);
  const agentDockThreadId = useCaptureStore((state) => state.agentDockThreadId);
  const agentDockContextNonce = useCaptureStore((state) => state.agentDockContextNonce);
  const bindAgentDockThread = useCaptureStore((state) => state.bindAgentDockThread);
  const closeAgentDock = useCaptureStore((state) => state.closeAgentDock);

  return (
    <ContextualAgentDock
      testId="capture-agent-dock"
      scope={agentDockScope}
      threadId={agentDockThreadId}
      contextNonce={agentDockContextNonce}
      onBindThread={bindAgentDockThread}
      onClose={closeAgentDock}
    />
  );
}

function CapturePageInner() {
  const captureMode = useCaptureStore((state) => state.captureMode);
  const selectedUnderstandingId = useCaptureStore((state) => state.selectedUnderstandingId);
  const agentDockOpen = useCaptureStore((state) => state.agentDockOpen);
  const selectDomain = useCaptureStore((state) => state.selectDomain);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const resetAfterUnderstandingDeleted = useCaptureStore(
    (state) => state.resetAfterUnderstandingDeleted,
  );
  const setSearchOpen = useCaptureStore((state) => state.setSearchOpen);
  const openAgentDock = useCaptureStore((state) => state.openAgentDock);

  const handleWikiLinkClick = (understandingId: string) => {
    selectDomain("all");
    setSearchOpen(false);
    selectUnderstanding(understandingId);
  };

  return (
    <div
      data-testid="capture-page"
      className="grid h-full min-h-0 w-full grid-cols-[248px_minmax(0,1fr)] overflow-hidden bg-background/45 backdrop-blur-2xl"
    >
      <DomainTree onChat={openAgentDock} />
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={
          agentDockOpen
            ? {
                "capture-main": 64,
                "capture-agent": 36,
              }
            : {
                "capture-main": 100,
              }
        }
        className="min-h-0 min-w-0 border-l bg-card/95 backdrop-blur-sm"
      >
        <ResizablePanel
          id="capture-main"
          minSize={agentDockOpen ? "44%" : "100%"}
          defaultSize={agentDockOpen ? "64%" : "100%"}
          className="min-h-0 min-w-0"
        >
          {captureMode === "wander" ? (
            <Suspense
              fallback={
                <div className="flex h-full min-h-0 flex-col bg-background">
                  <div className="flex h-14 shrink-0 items-center border-b px-5">
                    <Skeleton className="h-8 w-28" />
                  </div>
                  <div className="min-h-0 flex-1" />
                </div>
              }
            >
              <KnowledgeWanderWorkspace onChat={openAgentDock} />
            </Suspense>
          ) : (
            <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(280px,360px)_minmax(0,1fr)] overflow-hidden bg-transparent">
              <UnderstandingList onChat={openAgentDock} />
              <main className="min-h-0 min-w-0 overflow-hidden bg-transparent">
                {selectedUnderstandingId ? (
                  <UnderstandingDetail
                    understandingId={selectedUnderstandingId}
                    onWikiLinkClick={handleWikiLinkClick}
                    onChat={openAgentDock}
                    onDeleted={() => resetAfterUnderstandingDeleted(selectedUnderstandingId)}
                  />
                ) : (
                  <Empty className="h-full">
                    <EmptyContent>
                      <EmptyMedia variant="icon">
                        <FileText />
                      </EmptyMedia>
                      <EmptyDescription>选择一条内容开始查看</EmptyDescription>
                    </EmptyContent>
                  </Empty>
                )}
              </main>
            </div>
          )}
        </ResizablePanel>
        {agentDockOpen ? (
          <>
            <ResizableHandle
              withHandle
              className="w-3 cursor-col-resize bg-transparent after:w-px after:bg-border/50 hover:after:bg-border data-[resize-handle-active]:after:bg-ring [&>div]:h-10 [&>div]:w-0.5 [&>div]:bg-border/70"
            />
            <ResizablePanel
              id="capture-agent"
              minSize="28%"
              defaultSize="36%"
              maxSize="56%"
              className="min-h-0 min-w-0"
            >
              <CaptureAgentDock />
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}

export function CapturePage() {
  return <CapturePageInner />;
}
