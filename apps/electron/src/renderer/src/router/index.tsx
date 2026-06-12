import { Navigate, createHashRouter } from "react-router-dom";
import { AppLayout } from "@renderer/modules/shared/layout/AppLayout";
import { CapturePage } from "@renderer/modules/capture";
import { ContemplatePage } from "@renderer/modules/contemplate";
import { ChatPage } from "@renderer/modules/chat";
import { DomainWorkspaceDemoPage } from "@renderer/modules/demo/domain-workspace";

export const routes = [
  { label: "Capture", path: "/capture", value: "Capture", description: "Collect" },
  { label: "Contemplate", path: "/contemplate", value: "Contemplate", description: "Connect" },
  { label: "Agent", path: "/agent", value: "Agent", description: "Chat with your knowledge" },
  {
    label: "Demo",
    path: "/demo/domain-workspace",
    value: "DomainWorkspaceDemo",
    description: "Domain Workspace demo",
  },
] as const;

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/capture" replace /> },
      { path: "capture", id: "Capture", element: <CapturePage /> },
      { path: "contemplate", id: "Contemplate", element: <ContemplatePage /> },
      { path: "agent", id: "Agent", element: <ChatPage /> },
      {
        path: "demo/domain-workspace",
        id: "DomainWorkspaceDemo",
        element: <DomainWorkspaceDemoPage />,
      },
    ],
  },
]);
