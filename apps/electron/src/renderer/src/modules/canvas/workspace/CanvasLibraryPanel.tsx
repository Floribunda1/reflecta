import { FileText } from "lucide-react";
import type { MouseEvent } from "react";
import type { Node } from "@antv/x6";
import { createCanvasDndNode, type Dnd } from "@reflecta/ui/canvas";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import { useCaptureUnderstandingList, ALL_UNDERSTANDINGS_LIST_FILTER } from "../../capture/queries";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { newUnderstandingElement } from "./element-factory";

/**
 * 库面板最小闭环（Phase 1）：理解列表 + 拖入画布创建理解卡。
 * Phase 2 补全领域过滤 / 搜索 / 排序 / 列表展示与详情联动。
 */
export function CanvasLibraryPanel({ dnd }: { dnd: Dnd | null }) {
  const { data: understandings, isLoading } = useCaptureUnderstandingList(
    ALL_UNDERSTANDINGS_LIST_FILTER,
  );

  const handleDragStart = (event: MouseEvent, understanding: UnderstandingSummaryDTO) => {
    if (dnd) {
      dnd.start(
        createCanvasDndNode(newUnderstandingElement(understanding.id)) as Node,
        event.nativeEvent,
      );
    }
  };

  return (
    <aside
      data-testid="canvas-library-panel"
      className="flex h-full w-64 shrink-0 flex-col border-l bg-background"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <span className="text-sm font-medium">理解库</span>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">加载中…</div>
        ) : !understandings || understandings.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">还没有理解，先去 Capture 记录</div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {understandings.map((understanding) => (
              <button
                key={understanding.id}
                type="button"
                data-testid="canvas-library-item"
                data-understanding-id={understanding.id}
                data-understanding-title={understanding.title ?? "未命名理解"}
                className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                title="拖入画布创建理解卡"
                onMouseDown={(event) => handleDragStart(event, understanding)}
              >
                <FileText size={13} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {understanding.title ?? "未命名理解"}
                </span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
