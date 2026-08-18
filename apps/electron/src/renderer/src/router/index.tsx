import { Navigate, createHashRouter } from "react-router-dom";
import { AppLayout } from "@renderer/modules/shared/layout/AppLayout";
import { CanvasPage } from "@renderer/modules/canvas";
import { CapturePage } from "@renderer/modules/capture";
import { ChatPage } from "@renderer/modules/chat";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/capture" replace /> },
      { path: "capture", id: "Capture", element: <CapturePage /> },
      { path: "understanding-canvas", id: "Canvas", element: <CanvasPage /> },
      { path: "agent", id: "Agent", element: <ChatPage /> },
    ],
  },
]);
