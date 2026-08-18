import { Link2 } from "lucide-react";
import { useCanvasListByUnderstanding } from "./queries";
import { useNavigateToCanvas } from "@renderer/modules/shared/navigation";

/**
 * 画布归属区块（M6-6）：Capture 理解详情展示「出现于 N 张画布」，
 * 点击跳转画布模块打开指定画布（navigateToCanvas，T2 带参跳转）。
 */
export function CanvasMembership({ understandingId }: { understandingId: string }) {
  const { data: canvases } = useCanvasListByUnderstanding(understandingId);
  const navigateToCanvas = useNavigateToCanvas();

  if (!canvases || canvases.length === 0) return null;

  return (
    <section className="mt-10 flex flex-col gap-3 border-t border-border pt-8 pb-6">
      <div className="text-sm font-medium">出现于 {canvases.length} 张画布</div>
      <div className="flex flex-col gap-2">
        {canvases.map((canvas) => (
          <button
            key={canvas.id}
            type="button"
            data-testid="capture-understanding-canvas"
            data-canvas-id={canvas.id}
            data-canvas-title={canvas.title}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            onClick={() => navigateToCanvas(canvas.id)}
            title="在画布中打开"
          >
            <Link2 size={14} className="shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{canvas.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
