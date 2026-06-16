import { MouseEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ContemplatePageProvider, useContemplatePageContext } from "./context";
import { FilterPanel } from "./filter-panel";
import { GraphCanvas } from "./graph";
import { NodeDetail } from "./NodeDetail";

const MIN_PANEL_WIDTH = 440;
const MAX_PANEL_WIDTH = 680;
const DEFAULT_PANEL_WIDTH = 560;
const TITLEBAR_DRAG_LEFT_OFFSET = 220;

function ContemplatePageInner() {
  const ctx = useContemplatePageContext();
  const { setSelectedThoughtId } = ctx;
  const [searchParams] = useSearchParams();
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);

  useEffect(() => {
    const pending = searchParams.get("selectThoughtId");
    if (pending) setSelectedThoughtId(pending);
  }, [searchParams, setSelectedThoughtId]);

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
    <div className="contemplate-page relative h-full w-full overflow-hidden bg-background">
      <div
        className="app-drag-region absolute top-0 z-[15] h-12"
        style={{
          left: `${TITLEBAR_DRAG_LEFT_OFFSET}px`,
          right: ctx.selectedThoughtId !== null ? `${panelWidth}px` : 0,
        }}
      />
      <GraphCanvas />
      <FilterPanel />
      {ctx.selectedThoughtId !== null && (
        <div
          className="absolute bottom-0 right-0 top-0 z-10 flex overflow-hidden"
          style={{ width: `${panelWidth}px` }}
        >
          <div
            className="absolute bottom-0 left-0 top-0 z-20 w-1 cursor-col-resize transition-colors hover:bg-primary/10"
            onMouseDown={onDragHandleMouseDown}
          />
          <div className="flex-1 overflow-hidden">
            <NodeDetail />
          </div>
        </div>
      )}
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
