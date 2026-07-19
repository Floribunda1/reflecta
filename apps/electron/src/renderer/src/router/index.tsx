import { Navigate, createHashRouter } from "react-router-dom";
import { AppLayout } from "@renderer/modules/shared/layout/AppLayout";
import { CapturePage } from "@renderer/modules/capture";
import { ChatPage } from "@renderer/modules/chat";

export const routes = [
  { label: "Capture", path: "/capture", value: "Capture", description: "Collect" },
  { label: "Agent", path: "/agent", value: "Agent", description: "Chat with your knowledge" },
] as const;

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/capture" replace /> },
      { path: "capture", id: "Capture", element: <CapturePage /> },
      { path: "contemplate", element: <Navigate to="/capture" replace /> },
      { path: "agent", id: "Agent", element: <ChatPage /> },
    ],
  },
]);
