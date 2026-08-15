import { RouterProvider } from "react-router-dom";
import { Toaster } from "@reflecta/ui/components/sonner";
import { DrawerProvider, ModalProvider } from "@reflecta/ui/overlays";
import { router } from "./router";

// System-level errors (window.onerror / unhandledrejection) are recorded in
// the diagnostic log by the preload; they are deliberately NOT surfaced as
// toasts. Toasts are reserved for user-action failures reported by business
// code (e.g. "导出失败"), never for internal crashes.
export function App() {
  return (
    <ModalProvider>
      <DrawerProvider>
        <RouterProvider router={router} />
        <Toaster closeButton richColors position="bottom-right" />
      </DrawerProvider>
    </ModalProvider>
  );
}
