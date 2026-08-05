import { FileText } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useKeyPress, useMemoizedFn } from "ahooks";
import { usePanelRef } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@reflecta/ui/components/resizable";
import { ContextualAgentDock } from "@renderer/modules/chat/contextual-agent-dock";
import { DomainTree } from "./domain";
import { UnderstandingDetail } from "./understanding-detail";
import { UnderstandingList } from "./understanding-list";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@reflecta/ui/components/empty";
import { Skeleton } from "@reflecta/ui/components/skeleton";
import { cn } from "@reflecta/ui/lib/utils";
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
  const [domainSidebarOpen, setDomainSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const understandingListPanelRef = usePanelRef();
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

  const enterFocusMode = useMemoizedFn(() => {
    setFocusMode(true);
    understandingListPanelRef.current?.collapse();
  });
  const exitFocusMode = useMemoizedFn(() => {
    setFocusMode(false);
    understandingListPanelRef.current?.expand();
  });

  useKeyPress(
    "esc",
    () => {
      if (focusMode) exitFocusMode();
    },
    { exactMatch: true },
  );

  const handleWikiLinkClick = (understandingId: string) => {
    selectDomain("all");
    setSearchOpen(false);
    selectUnderstanding(understandingId);
  };

  return (
    <div
      data-testid="capture-page"
      className={cn(
        "grid h-full min-h-0 w-full overflow-hidden bg-background/45 transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none",
        domainSidebarOpen && !focusMode
          ? "grid-cols-[248px_minmax(0,1fr)]"
          : "grid-cols-[0px_minmax(0,1fr)]",
      )}
    >
      <div
        data-testid="capture-domain-sidebar-container"
        aria-hidden={!domainSidebarOpen || focusMode}
        inert={!domainSidebarOpen || focusMode}
        className={cn(
          "h-full min-w-0 overflow-hidden transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          domainSidebarOpen && !focusMode
            ? "translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-3 opacity-0",
        )}
      >
        <div className="h-full w-[248px]">
          <DomainTree onChat={openAgentDock} onCollapse={() => setDomainSidebarOpen(false)} />
        </div>
      </div>
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={
          agentDockOpen && !focusMode
            ? {
                "capture-main": 64,
                "capture-agent": 36,
              }
            : {
                "capture-main": 100,
              }
        }
        className="min-h-0 min-w-0 border-l bg-card/95"
      >
        <ResizablePanel
          id="capture-main"
          minSize={agentDockOpen && !focusMode ? "44%" : "100%"}
          defaultSize={agentDockOpen && !focusMode ? "64%" : "100%"}
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
              <KnowledgeWanderWorkspace
                onChat={openAgentDock}
                onExpandSidebar={domainSidebarOpen ? undefined : () => setDomainSidebarOpen(true)}
              />
            </Suspense>
          ) : (
            <ResizablePanelGroup
              orientation="horizontal"
              className="h-full min-h-0 min-w-0 bg-transparent"
            >
              <ResizablePanel
                id="capture-understanding-list-panel"
                panelRef={understandingListPanelRef}
                defaultSize="420px"
                minSize="280px"
                maxSize="60%"
                collapsedSize={0}
                collapsible
                groupResizeBehavior="preserve-pixel-size"
                className="min-h-0 min-w-0"
              >
                <div aria-hidden={focusMode} inert={focusMode} className="h-full">
                  <UnderstandingList
                    onChat={openAgentDock}
                    onExpandSidebar={
                      domainSidebarOpen ? undefined : () => setDomainSidebarOpen(true)
                    }
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                id="capture-understanding-list-resize-handle"
                disabled={focusMode}
                className={cn(
                  "cursor-col-resize bg-border/50 after:w-4 hover:bg-border data-[resize-handle-active]:bg-ring [&>div]:h-10 [&>div]:w-0.5 [&>div]:bg-border/70",
                  focusMode ? "w-0 opacity-0 after:hidden" : "w-px",
                )}
              />
              <ResizablePanel
                id="capture-understanding-detail-panel"
                minSize="320px"
                className="min-h-0 min-w-0"
              >
                <main className="h-full min-h-0 min-w-0 overflow-hidden bg-transparent">
                  {selectedUnderstandingId ? (
                    <UnderstandingDetail
                      understandingId={selectedUnderstandingId}
                      focusMode={focusMode}
                      onFocusModeChange={(focused) =>
                        focused ? enterFocusMode() : exitFocusMode()
                      }
                      onWikiLinkClick={handleWikiLinkClick}
                      onChat={(scope) => {
                        exitFocusMode();
                        openAgentDock(scope);
                      }}
                      onDeleted={() => {
                        exitFocusMode();
                        resetAfterUnderstandingDeleted(selectedUnderstandingId);
                      }}
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
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </ResizablePanel>
        {agentDockOpen && !focusMode ? (
          <>
            <ResizableHandle
              withHandle
              id="capture-agent-dock-resize-handle"
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
