import { useLocation, useNavigate } from "react-router-dom";
import { Bot, Check, ChevronUp, Inbox, Settings } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { SettingsDialogContent } from "@renderer/modules/settings/SettingsDialog";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";

const moduleItems = [
  { label: "Capture", path: "/capture", Icon: Inbox },
  { label: "Agent", path: "/agent", Icon: Bot },
] as const;

function getActiveModule(pathname: string) {
  return moduleItems.find((item) => pathname.startsWith(item.path)) ?? moduleItems[0];
}

export function AppChromeMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal } = useModal();
  const activeModule = getActiveModule(location.pathname);
  const ActiveIcon = activeModule.Icon;
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
      <DropdownMenu>
        <DropdownMenuTrigger
          data-no-drag
          data-testid="app-module-switcher"
          className="inline-flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-sm font-medium text-foreground/70 outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-foreground/5 data-popup-open:text-foreground"
          aria-label="Switch module"
        >
          <ActiveIcon size={15} />
          <span className="min-w-0 flex-1 truncate text-left">{activeModule.label}</span>
          <ChevronUp size={13} />
        </DropdownMenuTrigger>
        <DropdownMenuContent data-no-drag align="start" side="top" sideOffset={6} className="w-44">
          {moduleItems.map(({ label, path, Icon }) => {
            const active = activeModule.path === path;
            return (
              <DropdownMenuItem data-no-drag key={path} onClick={() => navigate(path)}>
                <Icon size={14} />
                <span className="flex-1">{label}</span>
                {active && <Check size={14} />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
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
