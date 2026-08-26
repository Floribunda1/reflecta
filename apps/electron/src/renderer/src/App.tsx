import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "@reflecta/ui/components/toast";
import { DrawerProvider, ModalProvider } from "@reflecta/ui/overlays";
import { router } from "./router";

// System-level errors (window.onerror / unhandledrejection) are recorded in
// the diagnostic log by the preload; they are deliberately NOT surfaced as
// toasts. Toasts are reserved for user-action failures reported by business
// code (e.g. "导出失败"), never for internal crashes.
export function App() {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ModalProvider>
          <DrawerProvider>
            <RouterProvider router={router} />
            <Toaster />
          </DrawerProvider>
        </ModalProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
