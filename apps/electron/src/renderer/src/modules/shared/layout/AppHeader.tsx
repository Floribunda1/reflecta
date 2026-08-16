import { useLocation } from "react-router-dom";
import { Separator } from "@reflecta/ui/components/separator";
import { cn } from "@reflecta/ui/lib/utils";
import { NAV_MODULES } from "./AppNavRail";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { useHeaderContentSlot } from "./header-content-context";
import { useRail } from "./rail-provider";

/**
 * 全局应用 header（对齐 shadcn dashboard-01 的 SiteHeader）。
 *
 * 结构： [SidebarTrigger] ┃ 模块标题 / 模块注入内容 …… [模块操作]
 * - 收/展 rail 的 hamburger 常驻 header，offcanvas 收起后仍可恢复；
 * - 收起的 offcanvas 会把 header 顶到窗口最左，需为 macOS 红绿灯预留横向空间；
 * - 模块标题是占位默认；业务模块（如 Agent 的线程标题+操作）通过
 *   useHeaderContent 注入 slot，见 header-content-context。
 */
export function AppHeader() {
  const location = useLocation();
  const { open, toggle } = useRail();
  const slot = useHeaderContentSlot();

  const activeModule =
    NAV_MODULES.find((module) => location.pathname.startsWith(module.path)) ?? NAV_MODULES[0];

  return (
    <header
      data-testid="app-header"
      className={cn(
        "app-drag-region flex h-12 shrink-0 items-center gap-2 border-b",
        // offcanvas 收起时 rail 宽度归 0，header 落到窗口最左 → 预留红绿灯
        //（trafficLightPosition.x=16，红绿灯横向约占到 ~x:76）。
        open ? "px-4" : "pl-[76px] pr-4",
      )}
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

      {slot ? (
        <div data-no-drag className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">{slot.title}</div>
          {slot.actions}
        </div>
      ) : (
        <>
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{activeModule.label}</h1>
          <div className="ml-auto flex shrink-0 items-center gap-2">{/* 右侧操作位（预留） */}</div>
        </>
      )}
    </header>
  );
}
