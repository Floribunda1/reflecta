import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { AppNavRail } from "./AppNavRail";
import { HeaderContentProvider } from "./header-content-context";
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
            {/* 内容区 = 一个圆角浮层卡（对齐 dashboard-01 SidebarInset：m+rounded+shadow）。
                HeaderContentProvider 同时包住 AppHeader 与路由内容，模块才能注入 header slot。 */}
            <main className="mx-2 my-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-sm ring-1 ring-foreground/10">
              <HeaderContentProvider>
                <AppHeader />
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                  <Outlet />
                </div>
              </HeaderContentProvider>
            </main>
          </div>
        </RailMenuProvider>
      </RailProvider>
    </div>
  );
}
