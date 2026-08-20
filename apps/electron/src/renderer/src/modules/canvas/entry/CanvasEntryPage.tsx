import { useEffect } from "react";
import { CanvasWorkspace } from "../workspace/CanvasWorkspace";
import { canvasStoreActions } from "../store";

/**
 * 画布入口页（T2 带参跳转落地）：消费 `?canvas=<id>`，渲染工作区。
 * 进入写入 store 选中态；卸载清空镜像与会话态。
 */
export function CanvasEntryPage({ canvasId }: { canvasId: string }) {
  useEffect(() => {
    canvasStoreActions.selectCanvas(canvasId);
    return () => canvasStoreActions.selectCanvas(null);
  }, [canvasId]);

  return <CanvasWorkspace key={canvasId} canvasId={canvasId} />;
}
