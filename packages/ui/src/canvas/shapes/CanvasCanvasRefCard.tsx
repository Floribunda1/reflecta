import { GitBranch, Link2, LockKeyhole } from "lucide-react";
import type { Node } from "@antv/x6";
import type { CanvasElementDTO } from "../document";
import { useCanvasShapeData } from "../shape-context";
import { CARD_BASE_CLASS, selectedCardClass } from "./shared";

/**
 * 画布引用卡（M3-E）：展示目标画布标题；点击跳转（navigateToCanvas）；
 * 目标画布被删除 → 「（已删除）」占位（M3-E4，referencedCanvases[].deleted）。
 */
export function CanvasCanvasRefCard({ node }: { node: Node }) {
  const element = node.getData<CanvasElementDTO>();
  const { referencedCanvases, onCanvasRefClick } = useCanvasShapeData();
  const canvasRefId = element.kind === "canvas_ref" ? element.canvasRefId : null;
  const target = canvasRefId ? referencedCanvases.get(canvasRefId) : undefined;
  const deleted = !target || target.deleted;

  const handleClick = () => {
    if (!deleted && canvasRefId) onCanvasRefClick?.(canvasRefId);
  };

  return (
    <button
      type="button"
      data-testid="canvas-canvas-ref-card"
      data-canvas-ref-id={canvasRefId ?? ""}
      className={`${CARD_BASE_CLASS} ${selectedCardClass(false)} cursor-pointer items-center justify-center gap-1.5 p-2 text-center`}
      onClick={handleClick}
      title={deleted ? "目标画布已删除" : "打开引用画布"}
    >
      {deleted ? (
        <>
          <LockKeyhole size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">（已删除）</span>
        </>
      ) : (
        <>
          <Link2 size={14} className="text-muted-foreground" />
          <span className="min-w-0 truncate text-xs font-medium">{target.title}</span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <GitBranch size={10} />
            打开画布
          </span>
        </>
      )}
    </button>
  );
}
