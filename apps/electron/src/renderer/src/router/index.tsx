import { Navigate, createHashRouter } from "react-router-dom";
import { AppLayout } from "@renderer/modules/shared/layout/AppLayout";
import { CapturePage } from "@renderer/modules/capture";
import { ChatPage } from "@renderer/modules/chat";
import { RecapPage } from "@renderer/modules/recap";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/capture" replace /> },
      { path: "capture", id: "Capture", element: <CapturePage /> },
      { path: "recap", id: "Recap", element: <RecapPage /> },
      { path: "agent", id: "Agent", element: <ChatPage /> },
    ],
  },
]);
