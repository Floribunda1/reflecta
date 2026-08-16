import { useMemo } from "react";
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
import { Sheet, SheetContent } from "@reflecta/ui/components/sheet";
import { ContextualAgentDock } from "@renderer/modules/chat/contextual-agent-dock";
import { DomainTree } from "./domain";
import { UnderstandingDetail } from "./understanding-detail";
import { CaptureDashboard } from "./dashboard/CaptureDashboard";
import { useCaptureStore } from "./store";

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

/** 详情抽屉 —— 复用 UnderstandingDetail 的完整编辑/上下文/AI 能力，宽 960px。 */
function UnderstandingDetailDrawer({ onClose }: { onClose: () => void }) {
  const selectedUnderstandingId = useCaptureStore((state) => state.selectedUnderstandingId);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const selectDomain = useCaptureStore((state) => state.selectDomain);
  const openAgentDock = useCaptureStore((state) => state.openAgentDock);
  const resetAfterUnderstandingDeleted = useCaptureStore(
    (state) => state.resetAfterUnderstandingDeleted,
  );

  const handleWikiLinkClick = (understandingId: string) => {
    // 切到全部领域，保证跳转目标在网格可见
    selectDomain("all");
    selectUnderstanding(understandingId);
  };

  return (
    <Sheet
      open={Boolean(selectedUnderstandingId)}
      onOpenChange={(isOpen) => {
        if (!isOpen) selectUnderstanding(null);
      }}
    >
      <SheetContent
        side="right"
        data-testid="capture-understanding-detail-drawer"
        showCloseButton={false}
        className="w-[min(960px,calc(100vw-2rem))] max-w-none p-0"
      >
        {selectedUnderstandingId ? (
          <div className="h-full min-h-0 w-full overflow-hidden">
            <UnderstandingDetail
              understandingId={selectedUnderstandingId}
              onClose={onClose}
              onWikiLinkClick={handleWikiLinkClick}
              onChat={(scope) => {
                onClose();
                openAgentDock(scope);
              }}
              onDeleted={() => {
                if (selectedUnderstandingId) {
                  resetAfterUnderstandingDeleted(selectedUnderstandingId);
                }
              }}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function CapturePageInner() {
  const agentDockOpen = useCaptureStore((state) => state.agentDockOpen);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const openAgentDock = useCaptureStore((state) => state.openAgentDock);

  const closeDetailDrawer = () => selectUnderstanding(null);

  // 领域树迁入全局导航 rail（slot 模式）；领域级 AI 对话入口保留
  const railMenu = useMemo(() => <DomainTree onChat={openAgentDock} />, [openAgentDock]);
  useRailMenu("capture", railMenu);

  return (
    <div
      data-testid="capture-page"
      className="relative h-full min-h-0 w-full overflow-hidden bg-background"
    >
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
        className="h-full min-h-0 min-w-0 bg-transparent"
      >
        <ResizablePanel
          id="capture-main"
          minSize={agentDockOpen ? "44%" : "100%"}
          defaultSize={agentDockOpen ? "64%" : "100%"}
          className="min-h-0 min-w-0"
        >
          <CaptureDashboard onChat={openAgentDock} />
        </ResizablePanel>
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

      <UnderstandingDetailDrawer onClose={closeDetailDrawer} />
    </div>
  );
}

export function CapturePage() {
  return <CapturePageInner />;
}
