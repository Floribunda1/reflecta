import { MouseEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import type { AgentContextRef } from "@shared/agent";
import { Button } from "@renderer/components/ui/button";
import { ContextualAgentDock } from "@renderer/modules/chat/contextual-agent-dock";
import { ContemplatePageProvider, useContemplatePageContext } from "./context";
import { FilterPanel } from "./filter-panel";
import { GraphCanvas } from "./graph";
import { NodeDetail } from "./NodeDetail";
import { ReviewWorkspace } from "./ReviewWorkspace";

const MIN_PANEL_WIDTH = 440;
const MAX_PANEL_WIDTH = 680;
const DEFAULT_PANEL_WIDTH = 560;
const AGENT_DOCK_WIDTH = 560;
const TITLEBAR_DRAG_LEFT_OFFSET = 220;

function sameAgentScope(left: AgentContextRef | null, right: AgentContextRef) {
  return Boolean(left && left.type === right.type && left.id === right.id);
}

function ContemplatePageInner() {
  const ctx = useContemplatePageContext();
  const { setSelectedUnderstandingId } = ctx;
  const [searchParams] = useSearchParams();
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [mode, setMode] = useState<"review" | "map">("review");
  const [agentDockOpen, setAgentDockOpen] = useState(false);
  const [agentDockScope, setAgentDockScope] = useState<AgentContextRef | null>(null);
  const [agentDockThreadId, setAgentDockThreadId] = useState<string | null>(null);
  const [agentDockContextNonce, setAgentDockContextNonce] = useState(0);
  const rightPanelWidth =
    (ctx.selectedUnderstandingId !== null ? panelWidth : 0) +
    (agentDockOpen ? AGENT_DOCK_WIDTH : 0);

  useEffect(() => {
    const pending = searchParams.get("selectUnderstandingId");
    if (pending) setSelectedUnderstandingId(pending);
  }, [searchParams, setSelectedUnderstandingId]);

  const openAgentDock = useCallback(
    (scope: AgentContextRef) => {
      if (!sameAgentScope(agentDockScope, scope)) setAgentDockThreadId(null);
      setAgentDockOpen(true);
      setAgentDockScope(scope);
      setAgentDockContextNonce((value) => value + 1);
    },
    [agentDockScope],
  );

  function onDragHandleMouseDown(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      setPanelWidth(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth + delta)));
    };
    const onMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      data-testid="contemplate-page"
      className="contemplate-page relative h-full w-full overflow-hidden bg-background"
    >
      <div
        className="app-drag-region absolute top-0 z-[15] h-12"
        style={{
          left: `${TITLEBAR_DRAG_LEFT_OFFSET}px`,
          right: `${rightPanelWidth}px`,
        }}
      />
      {mode === "review" ? (
        <ReviewWorkspace
          onOpenMap={() => setMode("map")}
          onEditUnderstanding={setSelectedUnderstandingId}
        />
      ) : (
        <>
          <GraphCanvas onChat={openAgentDock} />
          <FilterPanel />
          <Button
            type="button"
            variant="outline"
            className="absolute right-4 top-12 z-20 bg-background"
            onClick={() => setMode("review")}
          >
            <ArrowLeft size={15} />
            浏览领域
          </Button>
        </>
      )}
      {ctx.selectedUnderstandingId !== null && (
        <div
          className="absolute bottom-0 right-0 top-0 z-10 flex overflow-hidden"
          style={{
            right: agentDockOpen ? `${AGENT_DOCK_WIDTH}px` : 0,
            width: `${panelWidth}px`,
          }}
        >
          <div
            className="absolute bottom-0 left-0 top-0 z-20 w-1 cursor-col-resize transition-colors hover:bg-primary/10"
            onMouseDown={onDragHandleMouseDown}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="absolute right-3 top-2 z-30"
            aria-label="关闭理解详情"
            onClick={() => setSelectedUnderstandingId(null)}
          >
            <X size={15} />
          </Button>
          <div className="flex-1 overflow-hidden">
            <NodeDetail />
          </div>
        </div>
      )}
      {agentDockOpen && agentDockScope ? (
        <div
          className="absolute right-0 top-0 bottom-0 z-20 overflow-hidden border-l"
          style={{ width: `${AGENT_DOCK_WIDTH}px` }}
        >
          <ContextualAgentDock
            testId="contemplate-agent-dock"
            scope={agentDockScope}
            threadId={agentDockThreadId}
            contextNonce={agentDockContextNonce}
            onBindThread={setAgentDockThreadId}
            onClose={() => setAgentDockOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ContemplatePage() {
  return (
    <ContemplatePageProvider>
      <ContemplatePageInner />
    </ContemplatePageProvider>
  );
}
