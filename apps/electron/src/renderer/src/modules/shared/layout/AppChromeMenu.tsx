import { useLocation, useNavigate } from "react-router-dom";
import { Bot, Check, ChevronDown, GitBranch, Inbox, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { SettingsDialogContent } from "@renderer/modules/settings/SettingsDialog";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";

const moduleItems = [
  { label: "Capture", path: "/capture", Icon: Inbox },
  { label: "Contemplate", path: "/contemplate", Icon: GitBranch },
  { label: "Agent", path: "/agent", Icon: Bot },
] as const;

export const APP_CHROME_MENU_HIT_AREA_CLASS = "absolute left-[86px] top-[11px] h-7 w-32";

function getActiveModule(pathname: string) {
  return moduleItems.find((item) => pathname.startsWith(item.path)) ?? moduleItems[0];
}

export function AppChromeMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal } = useModal();
  const activeModule = getActiveModule(location.pathname);
  const ActiveIcon = activeModule.Icon;

  return (
    <div data-no-drag className={`${APP_CHROME_MENU_HIT_AREA_CLASS} z-50`}>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-no-drag
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-transparent px-1.5 text-sm font-medium text-foreground/65 outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-foreground/5 data-popup-open:text-foreground"
          aria-label="Switch module"
        >
          <ActiveIcon size={14} />
          {activeModule.label}
          <ChevronDown size={13} />
        </DropdownMenuTrigger>
        <DropdownMenuContent data-no-drag align="start" sideOffset={6} className="w-44">
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-no-drag
            onClick={() =>
              openModal(<SettingsDialogContent />, {
                title: "设置",
                widthClassName: "w-[min(80vw,calc(100vw-3rem))] max-w-none sm:max-w-none",
              })
            }
          >
            <Settings size={14} />
            <span className="flex-1">Settings</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
