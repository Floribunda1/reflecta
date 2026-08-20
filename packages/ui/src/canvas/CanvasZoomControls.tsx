import { Minus, Plus, Scan } from "lucide-react";
import { Button } from "../components/button";

/**
 * 左下控制（M2-4）：放大 / 缩小 / 适应视图。
 * 纯展示组件：动作由上层（workspace）接到 React Flow 句柄。
 */
export type CanvasZoomControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  className?: string;
};

export function CanvasZoomControls({
  onZoomIn,
  onZoomOut,
  onFit,
  className,
}: CanvasZoomControlsProps) {
  // 统一工具栏形态：圆角描边容器 + ghost 图标按钮（与节点/边工具栏一致）。
  return (
    <div
      data-testid="canvas-zoom-controls"
      className={`flex items-center gap-1 rounded-md border bg-background p-1 shadow-sm ${className ?? ""}`}
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="缩小"
        title="缩小"
        data-testid="canvas-zoom-out"
        onClick={onZoomOut}
      >
        <Minus size={14} />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="放大"
        title="放大"
        data-testid="canvas-zoom-in"
        onClick={onZoomIn}
      >
        <Plus size={14} />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="适应视图"
        title="适应视图"
        data-testid="canvas-zoom-fit"
        onClick={onFit}
      >
        <Scan size={14} />
      </Button>
    </div>
  );
}
