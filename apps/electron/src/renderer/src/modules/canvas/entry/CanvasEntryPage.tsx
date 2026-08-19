import { useEffect } from "react";
import { CanvasWorkspace } from "../workspace/CanvasWorkspace";
import { useCanvasStore } from "../store";

/**
 * 画布入口页（T2 带参跳转落地）：消费 `?canvas=<id>`，渲染工作区。
 * 进入写入 store 选中态；卸载清空镜像与会话态。
 */
export function CanvasEntryPage({ canvasId }: { canvasId: string }) {
  const selectCanvas = useCanvasStore((state) => state.selectCanvas);

  useEffect(() => {
    selectCanvas(canvasId);
    return () => selectCanvas(null);
  }, [canvasId, selectCanvas]);

  return <CanvasWorkspace key={canvasId} canvasId={canvasId} />;
}
