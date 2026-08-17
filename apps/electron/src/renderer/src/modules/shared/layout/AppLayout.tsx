import { Outlet } from "react-router-dom";
import { AppNavRail } from "./AppNavRail";
import { RailMenuProvider } from "./rail-menu-context";
import { RailProvider } from "./rail-provider";

export function AppLayout() {
  return (
    <div className="app-window relative flex h-screen flex-col overflow-hidden bg-transparent">
      {/* RailProvider 提升 rail 展开状态（持久化 + ⌘B）；RailMenuProvider 包住 rail 与路由内容，
          模块页面通过 useRailMenu 注入的菜单才能被 rail 的 slot 读到。 */}
      <RailProvider>
        <RailMenuProvider>
          <div className="flex flex-1 overflow-hidden">
            <AppNavRail />
            {/* 内容区自己管顶栏。侧栏展开时红绿灯在 rail；收起后各页 PageTopBar 负责避让。 */}
            <main className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background shadow-sm ring-1 ring-foreground/10">
              <Outlet />
            </main>
          </div>
        </RailMenuProvider>
      </RailProvider>
    </div>
  );
}
