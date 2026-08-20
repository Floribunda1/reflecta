import { Effect } from "effect";
import { useQuery } from "@tanstack/react-query";
import { rpc } from "@renderer/lib/effect-rpc";
import type { CanvasDetailDTO } from "@reflecta/server";
import { CanvasReadOnlyView, type CanvasShapeData } from "@reflecta/ui/canvas";
import { useMemo } from "react";
import { Button } from "@reflecta/ui/components/button";
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
  const detailQuery = useQuery({
    queryKey: ["agent.inspector.canvas", canvasId],
    queryFn: () => Effect.runPromise(rpc.canvasGet(canvasId)) as Promise<CanvasDetailDTO | null>,
    enabled: !!canvasId,
  });

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
        className="min-h-0 flex-1"
      />
    </div>
  );
}
