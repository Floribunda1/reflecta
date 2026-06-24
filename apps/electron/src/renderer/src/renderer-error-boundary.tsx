import { Component, type ErrorInfo, type ReactNode } from "react";

const DIAGNOSTIC_RENDERER_ERROR_CHANNEL = "diagnostic:renderer-error";

type RendererErrorBoundaryProps = {
  children: ReactNode;
};

type RendererErrorBoundaryState = {
  hasError: boolean;
};

function reportRendererBoundaryError(error: Error, errorInfo: ErrorInfo): void {
  try {
    window.ipcRenderer?.send(DIAGNOSTIC_RENDERER_ERROR_CHANNEL, {
      source: "react.error-boundary",
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      href: window.location.href,
      userAgent: navigator.userAgent,
    });
  } catch {
    // Error reporting must not throw while React is already recovering.
  }
}

export class RendererErrorBoundary extends Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RendererErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportRendererBoundaryError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground"
        >
          应用发生错误，请重启 Reflecta。
        </div>
      );
    }
    return this.props.children;
  }
}
