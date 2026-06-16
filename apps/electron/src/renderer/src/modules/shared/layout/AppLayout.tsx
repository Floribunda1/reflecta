import { Outlet } from "react-router-dom";
import { AppChromeMenu } from "./AppChromeMenu";

export function AppLayout() {
  return (
    <div className="app-window relative flex h-screen flex-col overflow-hidden bg-transparent">
      <AppChromeMenu />
      <div className="flex flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
