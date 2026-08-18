import { FileText, LockKeyhole } from "lucide-react";
import type { Node } from "@antv/x6";
import { SimpleMarkdownPreview } from "../../editor/simple-markdown-preview";
import type { CanvasElementDTO } from "../document";
import { useCanvasShapeData } from "../shape-context";
import { CARD_BASE_CLASS, selectedCardClass } from "./shared";

/**
 * 理解卡（计划 T4 / M3-A2）：全文展示不截断、无领域 / 上下文计数元数据、
 * 引用删除后显示「（已删除）」占位（M3-A5）。内容随 shapeData 上下文刷新
 * （M3-A6 / M6-3 同步），不重载画布文档。
 */
export function CanvasUnderstandingCard({ node }: { node: Node }) {
  const element = node.getData<CanvasElementDTO>();
  const { understandingRefs } = useCanvasShapeData();
  const ref =
    element.kind === "understanding" && element.understandingId
      ? understandingRefs.get(element.understandingId)
      : undefined;
  const deleted = !ref || ref.deleted;

  return (
    <div
      data-testid="canvas-understanding-card"
      data-understanding-id={
        element.kind === "understanding" ? (element.understandingId ?? "") : ""
      }
      className={`${CARD_BASE_CLASS} ${selectedCardClass(false)}`}
    >
      {deleted ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-muted-foreground">
          <LockKeyhole size={14} />
          <span className="text-xs">（已删除）</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 border-b px-2.5 py-1.5">
            <FileText size={12} className="shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {ref.title ?? "未命名理解"}
            </span>
          </div>
          <div className="canvas-card-scroll min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
            <SimpleMarkdownPreview value={ref.body} className="canvas-card-markdown" />
          </div>
        </>
      )}
    </div>
  );
}
