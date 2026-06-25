import { Navigate, createHashRouter } from "react-router-dom";
import { AppLayout } from "@renderer/modules/shared/layout/AppLayout";
import { CapturePage } from "@renderer/modules/capture";
import { ContemplatePage } from "@renderer/modules/contemplate";
import { ChatPage } from "@renderer/modules/chat";
import { ToolDemoPage } from "@renderer/modules/chat/tool-demo-page";

export const routes = [
  { label: "Capture", path: "/capture", value: "Capture", description: "Collect" },
  { label: "Contemplate", path: "/contemplate", value: "Contemplate", description: "Connect" },
  { label: "Agent", path: "/agent", value: "Agent", description: "Chat with your knowledge" },
  { label: "Tool Demo", path: "/tool-demo", value: "ToolDemo", description: "Inspect tools" },
] as const;

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/capture" replace /> },
      { path: "capture", id: "Capture", element: <CapturePage /> },
      { path: "contemplate", id: "Contemplate", element: <ContemplatePage /> },
      { path: "tool-demo", id: "ToolDemo", element: <ToolDemoPage /> },
      { path: "agent/tool-demo", id: "AgentToolDemo", element: <ToolDemoPage /> },
      { path: "agent", id: "Agent", element: <ChatPage /> },
    ],
  },
]);
