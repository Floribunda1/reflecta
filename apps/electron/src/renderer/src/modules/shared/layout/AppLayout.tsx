import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="app-window flex h-screen flex-col overflow-hidden bg-transparent">
      <div className="flex flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
