import { useLocation } from "react-router-dom";
import { Separator } from "@reflecta/ui/components/separator";
import { NAV_MODULES } from "./AppNavRail";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { useRail } from "./rail-provider";

/**
 * 全局应用 header（对齐 shadcn dashboard-01 的 SiteHeader）。
 *
 * 结构： [SidebarTrigger] | 模块标题  ----------  [右侧操作位]
 * - 收/展 rail 的 hamburger 常驻 header，offcanvas 收起后仍可恢复；
 * - 模块标题随路由高亮当前模块（仅展示，模块切换仍走 rail）；header 即窗口拖拽区。
 */
export function AppHeader() {
  const location = useLocation();
  const { open, toggle } = useRail();

  const activeModule =
    NAV_MODULES.find((module) => location.pathname.startsWith(module.path)) ?? NAV_MODULES[0];

  return (
    <header
      data-testid="app-header"
      className="app-drag-region flex h-12 shrink-0 items-center gap-2 border-b px-4"
    >
      <div data-no-drag>
        <SidebarToggleButton
          expanded={open}
          label={open ? "收起导航栏" : "展开导航栏"}
          testId="app-nav-rail-collapse-button"
          onClick={toggle}
        />
      </div>
      <Separator orientation="vertical" className="mx-1 data-vertical:h-5" />
      <h1 className="min-w-0 truncate text-sm font-medium">{activeModule.label}</h1>
      <div className="ml-auto flex shrink-0 items-center gap-2">{/* 右侧操作位（预留） */}</div>
    </header>
  );
}
