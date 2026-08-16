import { Outlet } from "react-router-dom";
import { AppNavRail } from "./AppNavRail";
import { RailMenuProvider } from "./rail-menu-context";

export function AppLayout() {
  return (
    <div className="app-window relative flex h-screen flex-col overflow-hidden bg-transparent">
      {/* RailMenuProvider 必须同时包住 rail 与路由内容：模块页面通过 useRailMenu
          注入的菜单（领域树 / 对话列表）才能被 rail 的 slot 读到。 */}
      <RailMenuProvider>
        <div className="flex flex-1 overflow-hidden">
          <AppNavRail />
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </RailMenuProvider>
    </div>
  );
}
