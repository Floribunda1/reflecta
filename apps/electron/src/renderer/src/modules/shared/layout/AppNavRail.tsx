import { useLocation, useNavigate } from "react-router-dom";
import { Bot, Network, NotepadText, Settings } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import { cn } from "@reflecta/ui/lib/utils";
import { useModal } from "@reflecta/ui/overlays";
import { SettingsDialogContent } from "@renderer/modules/settings/SettingsDialog";
import { SIDEBAR_WIDTH_CLASS } from "./layout-constants";
import { useRailMenuSlot } from "./rail-menu-context";
import { useRail } from "./rail-provider";

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

/** 导航标签区左侧对齐的一行按钮（模块或设置）。 */
function RailNavButton({
  icon,
  label,
  active = false,
  testId,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  testId?: string;
  onClick: () => void;
}) {
  return (
    <Button
      data-no-drag
      data-testid={testId}
      type="button"
      size="default"
      variant={active ? "secondary" : "ghost"}
      aria-pressed={active}
      className="w-full justify-start gap-2 px-2.5"
      onClick={onClick}
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </Button>
  );
}

export function AppNavRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal } = useModal();
  const menu = useRailMenuSlot();
  const { open, state } = useRail();

  const activeModule: NavModule =
    NAV_MODULES.find((module) => location.pathname.startsWith(module.path)) ?? NAV_MODULES[0];

  const handleModuleClick = (module: NavModule) => {
    navigate(module.path);
  };

  return (
    <aside
      data-testid="app-nav-rail"
      data-state={state}
      data-collapsible={state === "collapsed" ? "offcanvas" : undefined}
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none",
        open ? SIDEBAR_WIDTH_CLASS : "w-0",
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
          <nav
            data-testid="app-nav-label-area"
            className="mt-1 flex flex-col gap-1"
            aria-label="模块导航"
          >
            {NAV_MODULES.map((module) => {
              const active = module.id === activeModule.id;
              return (
                <RailNavButton
                  key={module.id}
                  icon={<module.Icon size={16} />}
                  label={module.label}
                  active={active}
                  testId={`app-nav-module-${module.id}`}
                  onClick={() => handleModuleClick(module)}
                />
              );
            })}

            <div data-no-drag aria-hidden className="my-1 border-t border-border" />

            {/* 设置与模块按钮同列放置（不居中、尺寸一致） */}
            <RailNavButton
              icon={<Settings size={16} />}
              label="设置"
              testId="app-settings-menu-item"
              onClick={() => openSettingsModal(openModal)}
            />
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden border-t border-border">
          {menu?.node ?? null}
        </div>
      </div>
    </aside>
  );
}
