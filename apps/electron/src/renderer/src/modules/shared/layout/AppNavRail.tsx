import { useLocation, useNavigate } from "react-router-dom";
import { Bot, NotebookPen, PanelsTopLeft, Settings } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import { cn } from "@reflecta/ui/lib/utils";
import { useModal } from "@reflecta/ui/overlays";
import { SettingsDialogContent } from "@renderer/modules/settings/SettingsDialog";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { useRailMenuSlot } from "./rail-menu-context";
import { useRail } from "./rail-provider";

/**
 * 模块注册表 —— 左 rail 的 NavigationLabelArea 与路由一一对应。
 * 每个模块的「菜单」（领域树 / 对话列表）由模块页面通过 useRailMenu 注入
 * （见 rail-menu-context），rail 本身不依赖任何业务模块。
 */
export const NAV_MODULES = [
  { id: "capture", path: "/capture", label: "捕获", Icon: NotebookPen },
  { id: "canvas", path: "/understanding-canvas", label: "画布", Icon: PanelsTopLeft },
  { id: "agent", path: "/agent", label: "对话", Icon: Bot },
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
      variant="ghost"
      aria-pressed={active}
      className={cn(
        "w-full justify-start gap-2 px-2.5",
        active && "bg-muted text-foreground hover:bg-muted",
      )}
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
  const { open, state, toggle } = useRail();

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
        "flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-sidebar/50 pb-2 text-sidebar-foreground w-full",
      )}
    >
      <div
        className="flex h-full min-h-0 flex-col"
        // 内容层固定为展开宽度（AppShell 注入 --rail-content-width）：
        // 收起/展开动画期间文字不回绕、菜单不挤压，只被 aside 的 overflow 裁剪。
        style={{ width: "var(--rail-content-width, 100%)" }}
      >
        {/* 顶栏常驻渲染（含红绿灯行的 h-12 避让）：收起动画期间它随内容一起滑出，
            不会被提前 unmount 造成内容上跳；完全收起后由面板 visibility 统一隐藏。
            testid 只在展开态挂载 —— 收起后这个按钮语义上不存在（恢复入口是 PageTopBar
            的 hamburger），避免与它同 testid 造成 e2e strict-mode 冲突。 */}
        <div className="app-drag-region flex h-12 shrink-0 items-center justify-end px-2">
          <div data-no-drag>
            <SidebarToggleButton
              expanded={open}
              label={open ? "收起导航栏" : "展开导航栏"}
              testId={open ? "app-nav-rail-collapse-button" : undefined}
              onClick={toggle}
            />
          </div>
        </div>
        <div className="app-drag-region shrink-0 px-2 pb-2">
          <nav
            data-testid="app-nav-label-area"
            className="flex flex-col gap-1"
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
