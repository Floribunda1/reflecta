import { Effect } from "effect";
import { useQuery } from "@tanstack/react-query";
import { effectQuery } from "@renderer/lib/effect-query";
import { rpc } from "@renderer/lib/effect-rpc";
import type { CanvasDetailDTO } from "@reflecta/server";
import { CanvasReadOnlyView, type CanvasShapeData } from "@reflecta/ui/canvas";
import { useMemo } from "react";
import { Button } from "@reflecta/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@reflecta/ui/components/dialog";
import { PanelTop } from "lucide-react";

/**
 * 画布只读查看（M8-6，F1 三用组件之一）：`[[cv:]]` 引用选中后渲染只读画布。
 * 复用 `CanvasReadOnlyView`（interacting: false），保证「所见即所存」；不跳路由。
 */
export function CanvasInspector({
  canvasId,
  onOpenEditor,
}: {
  canvasId: string;
  onOpenEditor?: (canvasId: string) => void;
}) {
  const detailQuery = useQuery(
    effectQuery.queryOptions({
      queryKey: ["agent.inspector.canvas", canvasId] as const,
      queryFn: () =>
        rpc.canvasGet(canvasId).pipe(Effect.map((dto) => dto as CanvasDetailDTO | null)),
      enabled: !!canvasId,
    }),
  );

  const shapeData = useMemo<CanvasShapeData | undefined>(() => {
    const detail = detailQuery.data;
    if (!detail) return undefined;
    return {
      understandingRefs: new Map((detail.understandingRefs ?? []).map((ref) => [ref.id, ref])),
      referencedCanvases: new Map((detail.referencedCanvases ?? []).map((ref) => [ref.id, ref])),
    };
  }, [detailQuery.data]);

  if (detailQuery.isFetching) {
    return <div className="p-4 text-sm text-muted-foreground">加载画布...</div>;
  }
  if (!detailQuery.data) {
    return (
      <div className="flex flex-col gap-3 p-4 text-sm text-muted-foreground">
        没有找到这张画布。
        {onOpenEditor ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-testid="canvas-inspector-open-editor"
            onClick={() => onOpenEditor(canvasId)}
          >
            <PanelTop size={14} />
            在画布编辑器中打开
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CanvasReadOnlyView
        document={{ elements: detailQuery.data.elements, edges: detailQuery.data.edges }}
        shapeData={shapeData}
        showZoomControls
        className="min-h-0 flex-1"
      />
    </div>
  );
}

/** Agent 页打开画布详情：只读 dialog，不占用右侧 inspector。 */
export function CanvasInspectDialog({
  canvasId,
  title,
  onClose,
}: {
  canvasId: string;
  title?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        data-testid="agent-canvas-dialog"
        className="h-[90vh] max-h-[90vh] w-[min(80vw,calc(100vw-3rem))] max-w-none overflow-hidden p-0 sm:max-w-none"
      >
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="px-4 pt-4 pr-12">
            <DialogTitle>{title?.trim() || "画布"}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
            <CanvasInspector canvasId={canvasId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
