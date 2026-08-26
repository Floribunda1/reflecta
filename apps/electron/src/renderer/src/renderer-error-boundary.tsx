import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportRendererError } from "./utils/renderer-error";

type RendererErrorBoundaryProps = {
  children: ReactNode;
};

type RendererErrorBoundaryState = {
  hasError: boolean;
};

function reportRendererBoundaryError(error: Error, errorInfo: ErrorInfo): void {
  reportRendererError("react.error-boundary", error, {
    componentStack: errorInfo.componentStack,
  });
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
