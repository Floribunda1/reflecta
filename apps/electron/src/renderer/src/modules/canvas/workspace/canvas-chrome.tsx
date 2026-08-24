import { memo, useEffect, type RefObject } from "react";
import { useAtomValue } from "@effect/atom-react";
import {
  CanvasEmptyState,
  CanvasSaveStatus,
  CanvasSearchOverlay,
  CanvasTextTool,
  CanvasUnderstandingTool,
  CanvasZoomControls,
  type CanvasGraphHandle,
  type CanvasSearchIndexItem,
} from "@reflecta/ui/canvas";
import { ResizableHandle, ResizablePanel } from "@reflecta/ui/components/resizable";
import { cn } from "@reflecta/ui/lib/utils";
import { RESIZE_HANDLE_CLASS } from "@renderer/modules/shared/layout/layout-constants";
import {
  canvasIsEmptyAtom,
  canvasLibraryOpenAtom,
  canvasPanelAtom,
  canvasSaveStatusAtom,
  canvasSearchOpenAtom,
  dispatchCanvasAction,
  getCanvasSessionState,
} from "../store";
import { CanvasDetailPanel } from "./CanvasDetailPanel";
import { CanvasLibraryPanel } from "./CanvasLibraryPanel";
import { buildCanvasSearchIndex } from "./canvas-workspace-model";
import { newCanvasRefElement, newTextElement, newUnderstandingElement } from "./element-factory";

export const CanvasSearchHotkeys = memo(function CanvasSearchHotkeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (meta && event.key.toLowerCase() === "f") {
        event.preventDefault();
        dispatchCanvasAction({ type: "search/toggled" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
});

export const CanvasToolStrip = memo(function CanvasToolStrip({
  graphRef,
}: {
  graphRef: RefObject<CanvasGraphHandle | null>;
}) {
  const libraryOpen = useAtomValue(canvasLibraryOpenAtom);
  return (
    <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-md border bg-background/90 p-1 shadow-sm">
      <CanvasTextTool
        onStartDrag={(event) => {
          graphRef.current?.startDrag(
            newTextElement({ width: 220, height: 120 }),
            undefined,
            event,
          );
        }}
        onClick={() => {
          const text = newTextElement();
          text.x = 120;
          text.y = 120;
          graphRef.current?.addElement(text);
        }}
      />
      <CanvasUnderstandingTool
        open={libraryOpen}
        onClick={() => dispatchCanvasAction({ type: "panel/toggleLibrary" })}
      />
    </div>
  );
});

export const CanvasSaveBadge = memo(function CanvasSaveBadge() {
  const saveStatus = useAtomValue(canvasSaveStatusAtom);
  return (
    <CanvasSaveStatus
      saveStatus={saveStatus}
      onRetry={() => dispatchCanvasAction({ type: "save/retry" })}
    />
  );
});

export const CanvasEmptyOverlay = memo(function CanvasEmptyOverlay() {
  const isEmpty = useAtomValue(canvasIsEmptyAtom);
  return isEmpty ? <CanvasEmptyState /> : null;
});

export const CanvasZoomDock = memo(function CanvasZoomDock({
  graphRef,
}: {
  graphRef: RefObject<CanvasGraphHandle | null>;
}) {
  return (
    <CanvasZoomControls
      className="absolute bottom-4 left-4"
      onZoomIn={() => graphRef.current?.zoomIn()}
      onZoomOut={() => graphRef.current?.zoomOut()}
      onFit={() => graphRef.current?.fitView()}
    />
  );
});

export const CanvasSearchHost = memo(function CanvasSearchHost({
  understandingRefs,
  referencedCanvases,
}: {
  understandingRefs: ReadonlyMap<string, { title: string | null; body: string }>;
  referencedCanvases: ReadonlyMap<string, { title: string }>;
}) {
  const searchOpen = useAtomValue(canvasSearchOpenAtom);
  if (!searchOpen) return null;
  const index: CanvasSearchIndexItem[] = buildCanvasSearchIndex(
    getCanvasSessionState().document,
    understandingRefs,
    referencedCanvases,
  );
  return (
    <CanvasSearchOverlay
      index={index}
      onSelect={(id) => dispatchCanvasAction({ type: "search/selected", id })}
      onClose={() => dispatchCanvasAction({ type: "search/closed" })}
    />
  );
});

export const CanvasSidePanelHost = memo(function CanvasSidePanelHost({
  canvasId,
  graphRef,
}: {
  canvasId: string;
  graphRef: RefObject<CanvasGraphHandle | null>;
}) {
  const rightPanel = useAtomValue(canvasPanelAtom);
  if (!rightPanel) return null;
  return (
    <>
      <ResizableHandle
        withHandle
        id="canvas-right-resize-handle"
        className={cn(RESIZE_HANDLE_CLASS)}
      />
      <ResizablePanel
        id="canvas-right"
        minSize="24%"
        maxSize="80%"
        defaultSize={60}
        className="min-h-0 min-w-0"
      >
        {rightPanel.mode === "library" ? (
          <CanvasLibraryPanel
            canvasId={canvasId}
            onClose={() => dispatchCanvasAction({ type: "panel/close" })}
            onStartDragUnderstanding={(id, title, event) => {
              dispatchCanvasAction({ type: "understanding/primed", id, title });
              graphRef.current?.startDrag(newUnderstandingElement(id), { title }, event);
            }}
            onPickUnderstanding={(id, title) => {
              dispatchCanvasAction({ type: "understanding/primed", id, title });
              graphRef.current?.addElement(newUnderstandingElement(id));
            }}
            onStartDragCanvas={(id, _title, event) =>
              graphRef.current?.startDrag(newCanvasRefElement(id), undefined, event)
            }
            onPickCanvas={(id, _title) => graphRef.current?.addElement(newCanvasRefElement(id))}
          />
        ) : (
          <CanvasDetailPanel
            key={rightPanel.understandingId}
            canvasId={canvasId}
            understandingId={rightPanel.understandingId}
            onClose={() => dispatchCanvasAction({ type: "panel/close" })}
            onSwitch={(nextId) =>
              dispatchCanvasAction({ type: "panel/openDetail", understandingId: nextId })
            }
          />
        )}
      </ResizablePanel>
    </>
  );
});
