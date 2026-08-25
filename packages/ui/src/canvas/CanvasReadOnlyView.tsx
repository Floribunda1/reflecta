import { useEffect, useRef } from "react";
import { cn } from "../lib/utils";
import { CanvasGraph, type CanvasGraphHandle } from "./CanvasGraph";
import { CanvasZoomControls } from "./CanvasZoomControls";
import type { CanvasDocument } from "@reflecta/shared";
import { EMPTY_CANVAS_SHAPE_DATA, type CanvasShapeData } from "./shape-context";

/**
 * 只读画布渲染器（F1 三用组件）：
 * `[[cv:]]` 引用 Modal / draft 提案预览 / artifact 缩略共用——结构化画布数据纯展示，
 * 无写入。交互仅保留查看（平移 / 缩放），编辑与事件桥全部关闭（interacting: false）。
 * 保证「所见即所存」。
 */
export type CanvasReadOnlyViewProps = {
  document: CanvasDocument;
  /** 卡片展示数据（理解卡全文字段 / 画布引用标题 / 删除占位） */
  shapeData?: CanvasShapeData;
  /** Agent 只读 Modal 需要放大 / 缩小 / 适应视图；缩略预览不要。 */
  showZoomControls?: boolean;
  /** 全屏查看（focus 模式）：提供后工具栏出现全屏切换钮，进入时自动适应视图。 */
  fullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
};

export function CanvasReadOnlyView({
  document,
  shapeData = EMPTY_CANVAS_SHAPE_DATA,
  showZoomControls = false,
  fullscreen = false,
  onFullscreenChange,
  className,
  style,
}: CanvasReadOnlyViewProps) {
  const graphRef = useRef<CanvasGraphHandle>(null);

  // 全屏切换后容器尺寸变化（CSS focus 模式），等布局落定再适应视图，
  // 保证内容在放大后的视口里完整可见。
  useEffect(() => {
    if (!fullscreen) return;
    let cancelled = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!cancelled) graphRef.current?.fitView();
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [fullscreen]);

  if (!showZoomControls) {
    return (
      <CanvasGraph
        readonly
        document={document}
        shapeData={shapeData}
        className={className}
        style={style}
        testId="canvas-readonly-graph"
      />
    );
  }
  return (
    <div className={cn("relative min-h-0", className)} style={style}>
      <CanvasGraph
        ref={graphRef}
        readonly
        document={document}
        shapeData={shapeData}
        className="h-full min-h-0 w-full"
        testId="canvas-readonly-graph"
      />
      <CanvasZoomControls
        className="absolute bottom-4 left-4"
        onZoomIn={() => graphRef.current?.zoomIn()}
        onZoomOut={() => graphRef.current?.zoomOut()}
        onFit={() => graphRef.current?.fitView()}
        fullscreen={fullscreen}
        onFullscreenChange={onFullscreenChange}
      />
    </div>
  );
}
