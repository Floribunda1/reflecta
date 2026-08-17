import { lazy, Suspense, startTransition, useEffect, useMemo, useState } from "react";
import { useRailMenu } from "@renderer/modules/shared/layout/rail-menu-context";
import {
  RESIZE_HANDLE_CLASS,
  RESIZE_HANDLE_GRIP_CHILD_CLASS,
} from "@renderer/modules/shared/layout/layout-constants";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@reflecta/ui/components/resizable";
import { DomainTree } from "./domain";
import { CaptureDashboard, CaptureToolbar } from "./dashboard/CaptureDashboard";
import { useCaptureStore } from "./store";

const UnderstandingDetail = lazy(async () => {
  const module = await import("./understanding-detail");
  return { default: module.UnderstandingDetail };
});

const ContextualAgentDock = lazy(async () => {
  const module = await import("@renderer/modules/chat/contextual-agent-dock");
  return { default: module.ContextualAgentDock };
});

function CaptureAgentDock() {
  const agentDockScope = useCaptureStore((state) => state.agentDockScope);
  const agentDockThreadId = useCaptureStore((state) => state.agentDockThreadId);
  const agentDockContextNonce = useCaptureStore((state) => state.agentDockContextNonce);
  const bindAgentDockThread = useCaptureStore((state) => state.bindAgentDockThread);
  const closeAgentDock = useCaptureStore((state) => state.closeAgentDock);

  return (
    <Suspense fallback={null}>
      <ContextualAgentDock
        testId="capture-agent-dock"
        scope={agentDockScope}
        threadId={agentDockThreadId}
        contextNonce={agentDockContextNonce}
        onBindThread={bindAgentDockThread}
        onClose={closeAgentDock}
      />
    </Suspense>
  );
}

/** 详情面板 —— 右侧内联展示 UnderstandingDetail 的完整编辑/上下文/AI 能力（非抽屉浮层）。 */
function UnderstandingDetailPanel() {
  const selectedUnderstandingId = useCaptureStore((state) => state.selectedUnderstandingId);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const selectDomain = useCaptureStore((state) => state.selectDomain);
  const openAgentDock = useCaptureStore((state) => state.openAgentDock);
  const resetAfterUnderstandingDeleted = useCaptureStore(
    (state) => state.resetAfterUnderstandingDeleted,
  );
  const [editorId, setEditorId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedUnderstandingId) {
      setEditorId(null);
      return;
    }
    startTransition(() => setEditorId(selectedUnderstandingId));
  }, [selectedUnderstandingId]);

  if (!selectedUnderstandingId) return null;

  const handleWikiLinkClick = (understandingId: string) => {
    // 切到全部领域，保证跳转目标在网格可见
    selectDomain("all");
    selectUnderstanding(understandingId);
  };

  return (
    <ResizablePanel id="capture-detail" minSize="26%" maxSize="60%" className="min-h-0 min-w-0">
      <div
        data-testid="capture-understanding-detail-panel"
        className="h-full min-h-0 w-full overflow-hidden"
      >
        {editorId ? (
          <Suspense fallback={null}>
            <UnderstandingDetail
              understandingId={editorId}
              onClose={() => selectUnderstanding(null)}
              onWikiLinkClick={handleWikiLinkClick}
              onChat={openAgentDock}
              onDeleted={() => {
                if (selectedUnderstandingId) {
                  resetAfterUnderstandingDeleted(selectedUnderstandingId);
                }
              }}
            />
          </Suspense>
        ) : null}
      </div>
    </ResizablePanel>
  );
}

function CapturePageInner() {
  const agentDockOpen = useCaptureStore((state) => state.agentDockOpen);
  const selectedUnderstandingId = useCaptureStore((state) => state.selectedUnderstandingId);
  const openAgentDock = useCaptureStore((state) => state.openAgentDock);

  const detailOpen = Boolean(selectedUnderstandingId);

  useEffect(() => {
    const prefetch = () => {
      void import("./understanding-detail");
    };
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(prefetch);
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = window.setTimeout(prefetch, 1);
    return () => window.clearTimeout(timeoutId);
  }, []);

  // 领域树迁入全局导航 rail（slot 模式）；领域级 AI 对话入口保留
  const railMenu = useMemo(() => <DomainTree onChat={openAgentDock} />, [openAgentDock]);
  useRailMenu("capture", railMenu);

  const defaultLayout = useMemo<Record<string, number>>(() => {
    const layout: Record<string, number> = { "capture-main": 100 };
    if (detailOpen) {
      layout["capture-main"] = agentDockOpen ? 42 : 58;
      layout["capture-detail"] = agentDockOpen ? 32 : 42;
    }
    if (agentDockOpen) {
      layout["capture-main"] = detailOpen ? 42 : 64;
      layout["capture-agent"] = detailOpen ? 26 : 36;
    }
    return layout;
  }, [agentDockOpen, detailOpen]);

  return (
    <div
      data-testid="capture-page"
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
    >
      <CaptureToolbar />
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={defaultLayout}
        className="min-h-0 min-w-0 flex-1 bg-transparent"
      >
        <ResizablePanel
          id="capture-main"
          minSize={agentDockOpen || detailOpen ? "30%" : "100%"}
          defaultSize={agentDockOpen || detailOpen ? 58 : 100}
          className="min-h-0 min-w-0"
        >
          <CaptureDashboard onChat={openAgentDock} />
        </ResizablePanel>
        {detailOpen ? (
          <>
            <ResizableHandle
              withHandle
              id="capture-detail-resize-handle"
              className={RESIZE_HANDLE_CLASS + " " + RESIZE_HANDLE_GRIP_CHILD_CLASS}
            />
            <UnderstandingDetailPanel />
          </>
        ) : null}
        {agentDockOpen ? (
          <>
            <ResizableHandle
              withHandle
              id="capture-agent-dock-resize-handle"
              className={RESIZE_HANDLE_CLASS + " " + RESIZE_HANDLE_GRIP_CHILD_CLASS}
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
