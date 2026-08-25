import { Frame, Maximize2, Minus, Minimize2, Plus } from "lucide-react";
import { Button } from "../components/button";

/**
 * 左下控制（M2-4）：放大 / 缩小 / 适应视图，可选全屏切换（focus 模式）。
 * 纯展示组件：动作由上层（workspace / 只读卡）接到图句柄。
 */
export type CanvasZoomControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  /** 提供后渲染全屏切换钮（与 understanding focus 模式同义：Maximize2 进入 / Minimize2 退出）。 */
  fullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
  className?: string;
};

export function CanvasZoomControls({
  onZoomIn,
  onZoomOut,
  onFit,
  fullscreen = false,
  onFullscreenChange,
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
        <Frame size={14} />
      </Button>
      {onFullscreenChange ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={fullscreen ? "退出全屏查看" : "全屏查看画布"}
          title={fullscreen ? "退出全屏查看（Esc）" : "全屏查看画布"}
          data-testid="canvas-zoom-fullscreen"
          onClick={() => onFullscreenChange(!fullscreen)}
        >
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </Button>
      ) : null}
    </div>
  );
}
