import { FileText, X } from "lucide-react";
import { useEffect } from "react";
import type { AgentContextRef } from "@shared/agent";
import { Button } from "@renderer/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@renderer/components/ui/resizable";
import { AgentThreadPanel } from "@renderer/modules/chat/agent-thread-panel";
import { useCreateThreadMutation } from "@renderer/modules/chat/session/server-state";
import { DomainTree } from "./domain";
import { UnderstandingDetail } from "./understanding-detail";
import { UnderstandingList } from "./understanding-list";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import { useCaptureStore, type CaptureAgentScope } from "./store";

function scopeTitle(scope: CaptureAgentScope | null) {
  return scope?.title?.trim() || (scope?.type === "domain" ? "当前领域" : "当前理解");
}

function scopeContextRef(scope: CaptureAgentScope | null): AgentContextRef[] {
  return scope ? [{ type: scope.type, id: scope.id, title: scope.title }] : [];
}

function CaptureAgentDock() {
  const agentDockScope = useCaptureStore((state) => state.agentDockScope);
  const agentDockThreadId = useCaptureStore((state) => state.agentDockThreadId);
  const agentDockContextNonce = useCaptureStore((state) => state.agentDockContextNonce);
  const bindAgentDockThread = useCaptureStore((state) => state.bindAgentDockThread);
  const closeAgentDock = useCaptureStore((state) => state.closeAgentDock);
  const createThreadMutation = useCreateThreadMutation();
  const contextKey = agentDockScope
    ? `${agentDockScope.type}:${agentDockScope.id}:${agentDockContextNonce}`
    : undefined;

  useEffect(() => {
    if (agentDockThreadId || createThreadMutation.isPending) return;
    createThreadMutation.mutate(`聊聊：${scopeTitle(agentDockScope)}`, {
      onSuccess: (thread) => bindAgentDockThread(thread.id),
    });
  }, [agentDockScope, agentDockThreadId, bindAgentDockThread, createThreadMutation]);

  return (
    <aside
      data-testid="capture-agent-dock"
      className="flex h-full min-h-0 min-w-0 flex-col bg-card/90"
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">Agent</div>
          <div className="truncate text-xs text-muted-foreground">{scopeTitle(agentDockScope)}</div>
        </div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="关闭 Agent"
          onClick={closeAgentDock}
        >
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        {agentDockThreadId ? (
          <AgentThreadPanel
            threadId={agentDockThreadId}
            initialContextKey={contextKey}
            initialContextRefs={scopeContextRef(agentDockScope)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            加载 Agent...
          </div>
        )}
      </div>
    </aside>
  );
}

function CapturePageInner() {
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
