import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, PanelsTopLeft } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@reflecta/ui/components/empty";
import { CANVAS_ROUTE } from "@renderer/modules/shared/navigation";
import { useCanvasDetail } from "../queries";
import { useCanvasStore } from "../store";

/**
 * 画布入口页（计划 Phase 0 占位；Phase 1 起替换为画布工作区）。
 *
 * 职责：消费 `?canvas=<id>`（T2 带参跳转），加载详情、写入 canvas store
 * （selectedCanvasId 语义）、提供返回列表路径。工作区落地后本组件退位为路由容器。
 */
export function CanvasEntryPage({ canvasId }: { canvasId: string }) {
  const navigate = useNavigate();
  const selectCanvas = useCanvasStore((state) => state.selectCanvas);
  const { data: detail, isLoading } = useCanvasDetail(canvasId);

  // 打开画布：写入 store 选中态（工作区消费）；卸载时清空镜像与会话态
  useEffect(() => {
    selectCanvas(canvasId);
    return () => selectCanvas(null);
  }, [canvasId, selectCanvas]);

  const goBack = () => {
    navigate(CANVAS_ROUTE);
  };

  const canvas = detail?.canvas ?? null;

  return (
    <div
      data-testid="canvas-entry-page"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Empty>
          <EmptyContent>
            <EmptyMedia variant="icon">
              <PanelsTopLeft />
            </EmptyMedia>
            {isLoading ? (
              <EmptyDescription>正在打开画布…</EmptyDescription>
            ) : canvas ? (
              <>
                <EmptyTitle>{canvas.title}</EmptyTitle>
                <EmptyDescription>画布工作区（Phase 1）尚未实现，暂以入口占位预览</EmptyDescription>
              </>
            ) : (
              <>
                <EmptyTitle>画布不存在或已被删除</EmptyTitle>
                <EmptyDescription>返回列表查看其余画布</EmptyDescription>
              </>
            )}
          </EmptyContent>
        </Empty>
      </div>
      <div className="flex shrink-0 items-center justify-center gap-2 p-4">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={goBack}
          data-testid="canvas-entry-back-button"
        >
          <ArrowLeft size={14} />
          返回画布列表
        </Button>
      </div>
    </div>
  );
}
