import { Navigate, createHashRouter } from "react-router-dom";
import { AppLayout } from "@renderer/modules/shared/layout/AppLayout";
import { CanvasPage } from "@renderer/modules/canvas";
import { CapturePage } from "@renderer/modules/capture";
import { ChatPage } from "@renderer/modules/chat";

function RootRouteError() {
  return (
    <div
      role="alert"
      className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground"
    >
      应用发生错误，请重启 Reflecta。
    </div>
  );
}

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RootRouteError />,
    children: [
      { index: true, element: <Navigate to="/capture" replace /> },
      { path: "capture", id: "Capture", element: <CapturePage /> },
      { path: "understanding-canvas", id: "Canvas", element: <CanvasPage /> },
      { path: "agent", id: "Agent", element: <ChatPage /> },
    ],
  },
]);
