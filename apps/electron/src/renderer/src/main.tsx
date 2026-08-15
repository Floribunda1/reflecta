import "./style.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@reflecta/ui/theme";
import { App } from "./App";
import { RendererErrorBoundary } from "./renderer-error-boundary";
import { reportRendererError } from "./utils/renderer-error";
import { useAppliedTheme } from "./modules/settings/use-applied-theme";

function ThemeBridge() {
  useAppliedTheme();
  return null;
}

const queryClient = new QueryClient();
const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root was not found.");
}

createRoot(root, {
  // Route render-phase errors through the diagnostic log with React's own
  // context (component stack). window.onerror alone cannot attribute these
  // to a component in production builds.
  onUncaughtError: (error, errorInfo) => {
    reportRendererError("react.uncaught", error, {
      componentStack: errorInfo.componentStack,
    });
  },
  onCaughtError: (error, errorInfo) => {
    reportRendererError("react.caught", error, {
      componentStack: errorInfo.componentStack,
    });
  },
}).render(
  <StrictMode>
    <RendererErrorBoundary>
      <ThemeProvider>
        <ThemeBridge />
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ThemeProvider>
    </RendererErrorBoundary>
  </StrictMode>,
);
