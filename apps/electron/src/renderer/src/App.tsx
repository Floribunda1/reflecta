import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { toast } from "sonner";
import { Toaster } from "@renderer/components/ui/sonner";
import { DrawerContextProvider } from "./modules/shared/hooks/use-drawer";
import { ModalProvider } from "./modules/shared/hooks/use-modal";
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
      toast.error("操作失败", {
        id: "fallback-unhandled-rejection",
        description: fallbackToastMessage(event.reason),
      });
    };
    const onError = (event: ErrorEvent) => {
      toast.error("应用发生错误", {
        id: "fallback-window-error",
        description: fallbackToastMessage(event.error ?? event.message),
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
    <ModalProvider>
      <DrawerContextProvider>
        <RouterProvider router={router} />
        <Toaster closeButton richColors position="bottom-right" />
        <FallbackToastBoundary />
      </DrawerContextProvider>
    </ModalProvider>
  );
}
