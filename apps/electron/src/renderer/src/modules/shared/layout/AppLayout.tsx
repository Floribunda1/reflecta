import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Cog } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { SettingsDialogContent } from "@renderer/modules/settings/SettingsDialog";
import { GlobalSearch } from "@renderer/modules/shared/biz-components/GlobalSearch";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import { routes } from "@renderer/router";
import appIcon from "../../../../../../build/icon.png";

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openModal } = useModal();

  const openSettings = () => {
    openModal(<SettingsDialogContent />, {
      title: "设置",
      widthClassName: "max-w-5xl",
      className: "!p-0",
    });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-[54px] shrink-0 items-center gap-6 border-b border-border bg-background px-6">
        <div className="flex items-center gap-3">
          <img src={appIcon} alt="" className="h-7 w-7 select-none rounded-md object-contain" />
          <span className="select-none text-[18px] font-semibold leading-none text-foreground">
            Reflecta
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {routes.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={active ? "default" : "ghost"}
                aria-label={item.description}
                onClick={() => {
                  if (!active) void navigate(item.path);
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <GlobalSearch />
          <Button size="icon-sm" variant="ghost" aria-label="设置" onClick={openSettings}>
            <Cog size={17} />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
