import { PanelsTopLeft } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@reflecta/ui/components/empty";

/**
 * 画布模块（/understanding-canvas）。
 *
 * v2.0.0 画布模块尚未实现（渲染引擎已定 AntV X6，见共识 C11 与
 * `docs/iterations/v2.0.0/understanding-canvas-frontend-plan.md`）。
 * 路由与 rail 入口保留，此处为最小占位页；Phase 0/1 落地后替换。
 */
export function CanvasPage() {
  return (
    <div
      data-testid="canvas-page"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Empty>
          <EmptyContent>
            <EmptyMedia variant="icon">
              <PanelsTopLeft />
            </EmptyMedia>
            <EmptyDescription>画布模块（v2.0.0）尚未实现</EmptyDescription>
          </EmptyContent>
        </Empty>
      </div>
    </div>
  );
}
