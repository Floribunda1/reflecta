import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, Network, NotepadText, Settings } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import { cn } from "@reflecta/ui/lib/utils";
import { useModal } from "@reflecta/ui/overlays";
import { SettingsDialogContent } from "@renderer/modules/settings/SettingsDialog";
import { SIDEBAR_WIDTH_CLASS } from "./layout-constants";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { useRailMenuSlot } from "./rail-menu-context";

/**
 * 模块注册表 —— 左 rail 的 NavigationLabelArea 与路由一一对应。
 * 每个模块的「菜单」（领域树 / 对话列表）由模块页面通过 useRailMenu 注入
 * （见 rail-menu-context），rail 本身不依赖任何业务模块。
 */
export const NAV_MODULES = [
  { id: "capture", path: "/capture", label: "Capture", Icon: NotepadText },
  { id: "agent", path: "/agent", label: "Agent", Icon: Bot },
  { id: "canvas", path: "/understanding-canvas", label: "Canvas", Icon: Network },
] as const;

type NavModule = (typeof NAV_MODULES)[number];

function openSettingsModal(openModal: ReturnType<typeof useModal>["openModal"]) {
  openModal(<SettingsDialogContent />, {
    title: "设置",
    widthClassName: "w-[min(80vw,calc(100vw-3rem))] max-w-none sm:max-w-none",
    className: "flex h-[90vh] max-h-[90vh] flex-col overflow-hidden",
  });
}

export function AppNavRail() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal } = useModal();
  const menu = useRailMenuSlot();

  const activeModule: NavModule =
    NAV_MODULES.find((module) => location.pathname.startsWith(module.path)) ?? NAV_MODULES[0];

  const handleModuleClick = (module: NavModule) => {
    if (collapsed) setCollapsed(false);
    navigate(module.path);
  };

  return (
    <aside
      data-testid="app-nav-rail"
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-14" : SIDEBAR_WIDTH_CLASS,
      )}
    >
      {/* DESIGN: translucent sidebar is intentional — macOS-style vibrancy.
          The window is configured transparent + vibrancy: under-window; the
          raised-surface alpha tint (base01) lets the frosted material show
          through while keeping the sidebar's raised-container semantic.
          Not covered by any token (it is a window-level effect, not a
          surface color), and required by the product design. */}
      <div className="flex h-full min-h-0 flex-col bg-sidebar/50">
        <div className="app-drag-region shrink-0 px-2 pt-14 pb-2">
          <div data-no-drag className="flex h-8 items-center justify-end">
            <SidebarToggleButton
              expanded={!collapsed}
              label={collapsed ? "展开导航栏" : "收起导航栏"}
              testId="app-nav-rail-collapse-button"
              onClick={() => setCollapsed((current) => !current)}
            />
          </div>
          <nav
            data-testid="app-nav-label-area"
            className="flex flex-col gap-1"
            aria-label="模块导航"
          >
            {NAV_MODULES.map((module) => {
              const active = module.id === activeModule.id;
              return (
                <Button
                  data-no-drag
                  key={module.id}
                  data-testid={`app-nav-module-${module.id}`}
                  data-nav-module={module.id}
                  aria-current={active ? "page" : undefined}
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "ghost"}
                  className="flex shrink-0 items-center gap-2 px-2"
                  onClick={() => handleModuleClick(module)}
                >
                  <module.Icon size={15} />
                  {!collapsed ? <span className="min-w-0 truncate">{module.label}</span> : null}
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden border-t border-border">
          {!collapsed ? (menu?.node ?? null) : null}
        </div>

        <div
          data-no-drag
          className="flex h-11 shrink-0 items-center justify-center border-t border-border"
        >
          <Button
            data-testid="app-settings-menu-item"
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="设置"
            title="设置"
            onClick={() => openSettingsModal(openModal)}
          >
            <Settings size={15} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
