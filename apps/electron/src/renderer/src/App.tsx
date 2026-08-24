import { useEffect } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { RouterProvider } from "react-router-dom";
import { toast } from "@reflecta/ui/components/toast";
import { Toaster } from "@reflecta/ui/components/toast";
import { DrawerProvider, ModalProvider } from "@reflecta/ui/overlays";
import { router } from "./router";

function fallbackToastMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "请稍后重试";
}

function FallbackToastBoundary() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      toast.add({
        id: "fallback-unhandled-rejection",
        title: "操作失败",
        description: fallbackToastMessage(event.reason),
        type: "error",
      });
    };
    const onError = (event: ErrorEvent) => {
      toast.add({
        id: "fallback-window-error",
        title: "应用发生错误",
        description: fallbackToastMessage(event.error ?? event.message),
        type: "error",
      });
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}

export function App() {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ModalProvider>
          <DrawerProvider>
            <RouterProvider router={router} />
            <Toaster />
            <FallbackToastBoundary />
          </DrawerProvider>
        </ModalProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
