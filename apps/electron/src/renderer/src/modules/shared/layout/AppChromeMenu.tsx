import { useLocation, useNavigate } from "react-router-dom";
import { Bot, NotepadText, Settings } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { SettingsDialogContent } from "@renderer/modules/settings/SettingsDialog";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";

export function AppChromeMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal } = useModal();
  const nextModule = location.pathname.startsWith("/agent")
    ? { label: "查看笔记", path: "/capture", Icon: NotepadText }
    : { label: "AI 对话", path: "/agent", Icon: Bot };
  const openSettings = () =>
    openModal(<SettingsDialogContent />, {
      title: "设置",
      widthClassName: "w-[min(80vw,calc(100vw-3rem))] max-w-none sm:max-w-none",
    });

  return (
    <div
      data-no-drag
      className="flex h-12 shrink-0 items-center gap-1 border-t border-border/60 px-2"
    >
      <Button
        data-no-drag
        data-testid="app-module-switcher"
        type="button"
        size="sm"
        variant="ghost"
        className="min-w-0 flex-1 justify-start text-foreground/70"
        aria-label={nextModule.label}
        onClick={() => navigate(nextModule.path)}
      >
        <nextModule.Icon size={15} />
        <span className="min-w-0 truncate">{nextModule.label}</span>
      </Button>
      <Button
        data-no-drag
        data-testid="app-settings-menu-item"
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="设置"
        onClick={openSettings}
      >
        <Settings size={15} />
      </Button>
    </div>
  );
}
