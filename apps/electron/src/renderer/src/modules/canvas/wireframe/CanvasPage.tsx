import { useMemo } from "react";
import { cn } from "@reflecta/ui/lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@reflecta/ui/components/resizable";
import {
  RESIZE_HANDLE_CLASS,
  RESIZE_HANDLE_GRIP_CHILD_CLASS,
} from "@renderer/modules/shared/layout/layout-constants";
import { useRailMenu } from "@renderer/modules/shared/layout/rail-menu-context";
import { CanvasRightPanel } from "./CanvasRightPanel";
import { CanvasSidebar } from "./CanvasSidebar";
import { CanvasTopBar } from "./CanvasTopBar";
import { CanvasWorkspace } from "./CanvasWorkspace";
import { useCanvasWireframeStore } from "./wireframe-store";

/**
 * 画布线框 · 页面组合（C1 骨架：左列画布列表注入 rail + 主区无限画布 + 右侧单面板）。
 *
 * 结构对齐 Capture：rail 菜单槽（useRailMenu）承载资源列表；
 * 主区 = PageTopBar + ResizablePanelGroup（画布工作区 | 右侧单面板）。
 */
export function CanvasPage() {
  const rightPanelOpen = useCanvasWireframeStore((state) => state.rightPanelOpen);

  const railMenu = useMemo(() => <CanvasSidebar />, []);
  useRailMenu("canvas", railMenu);

  const defaultLayout = useMemo<Record<string, number>>(
    () => ({
      "canvas-workspace": rightPanelOpen ? 70 : 100,
      ...(rightPanelOpen ? { "canvas-right-panel": 30 } : {}),
    }),
    [rightPanelOpen],
  );

  return (
    <div
      data-testid="canvas-page"
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
    >
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={defaultLayout}
        className="min-h-0 min-w-0 flex-1 bg-transparent"
      >
        <ResizablePanel
          id="canvas-workspace"
          minSize="45%"
          defaultSize={rightPanelOpen ? 70 : 100}
          className="min-h-0 min-w-0"
        >
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <CanvasTopBar />
            <div className="min-h-0 flex-1">
              <CanvasWorkspace />
            </div>
          </div>
        </ResizablePanel>
        {rightPanelOpen ? (
          <>
            <ResizableHandle
              withHandle
              id="canvas-right-panel-resize-handle"
              className={cn(RESIZE_HANDLE_CLASS, RESIZE_HANDLE_GRIP_CHILD_CLASS)}
            />
            <ResizablePanel
              id="canvas-right-panel"
              minSize="24%"
              defaultSize="30%"
              maxSize="50%"
              className="min-h-0 min-w-0"
            >
              <CanvasRightPanel />
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}
