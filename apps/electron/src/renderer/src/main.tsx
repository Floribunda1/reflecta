import "./style.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@reflecta/ui/theme";
import { RegistryContext } from "@effect/atom-react";
import { App } from "./App";
import { RendererErrorBoundary } from "./renderer-error-boundary";
import { useAppliedTheme } from "./modules/settings/use-applied-theme";
import { appAtomRegistry } from "./lib/atoms";

function ThemeBridge() {
  useAppliedTheme();
  return null;
}

const queryClient = new QueryClient();
const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root was not found.");
}

createRoot(root).render(
  <StrictMode>
    <RendererErrorBoundary>
      <RegistryContext.Provider value={appAtomRegistry}>
        <ThemeProvider>
          <ThemeBridge />
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </ThemeProvider>
      </RegistryContext.Provider>
    </RendererErrorBoundary>
  </StrictMode>,
);
