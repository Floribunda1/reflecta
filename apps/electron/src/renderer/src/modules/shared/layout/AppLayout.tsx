import { Outlet } from "react-router-dom";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@reflecta/ui/components/resizable";
import { AppNavRail } from "./AppNavRail";
import { RESIZE_HANDLE_SLIM_CLASS } from "./layout-constants";
import { RailMenuProvider } from "./rail-menu-context";
import {
  MAX_RAIL_WIDTH_PX,
  MIN_RAIL_WIDTH_PX,
  persistRailWidth,
  RailProvider,
  readRailWidth,
  useRail,
} from "./rail-provider";

function AppMain() {
  return (
    <main className="m-0 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background shadow-sm ring-1 ring-foreground/10">
      <Outlet />
    </main>
  );
}

function AppShell() {
  const { open } = useRail();
  const railWidthPx = readRailWidth();

  if (!open) {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppNavRail />
        <AppMain />
      </div>
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="app-shell">
      <ResizablePanel
        id="app-rail"
        defaultSize={railWidthPx}
        minSize={MIN_RAIL_WIDTH_PX}
        maxSize={MAX_RAIL_WIDTH_PX}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0"
        onResize={(size, _id, previous) => {
          if (!previous) return;
          persistRailWidth(size.inPixels);
        }}
      >
        <AppNavRail />
      </ResizablePanel>
      <ResizableHandle id="app-rail-resize-handle" className={RESIZE_HANDLE_SLIM_CLASS} />
      <ResizablePanel id="app-main" minSize="40%" className="min-h-0 min-w-0">
        <AppMain />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function AppLayout() {
  return (
    <div className="app-window relative flex h-screen flex-col overflow-hidden bg-transparent">
      {/* RailProvider 提升 rail 展开状态（持久化 + ⌘B）；RailMenuProvider 包住 rail 与路由内容，
          模块页面通过 useRailMenu 注入的菜单才能被 rail 的 slot 读到。 */}
      <RailProvider>
        <RailMenuProvider>
          <AppShell />
        </RailMenuProvider>
      </RailProvider>
    </div>
  );
}
