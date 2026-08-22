import { Library, PanelsTopLeft, Type } from "lucide-react";
import { Button } from "../components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "../components/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";

export function CanvasTextTool({
  onStartDrag,
  onClick,
}: {
  onStartDrag: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="文本"
            data-testid="canvas-tool-dnd-text"
            onMouseDown={onStartDrag}
            onClick={onClick}
          />
        }
      >
        <Type size={15} />
      </TooltipTrigger>
      <TooltipContent>文本</TooltipContent>
    </Tooltip>
  );
}

export function CanvasUnderstandingTool({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant={open ? "secondary" : "ghost"}
            aria-label="理解库"
            data-testid="canvas-toggle-library-button"
            onClick={onClick}
          />
        }
      >
        <Library size={15} />
      </TooltipTrigger>
      <TooltipContent>理解库</TooltipContent>
    </Tooltip>
  );
}

export function CanvasEmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <Empty>
        <EmptyContent>
          <EmptyMedia variant="icon">
            <PanelsTopLeft />
          </EmptyMedia>
          <EmptyTitle>这张画布还是空的</EmptyTitle>
          <EmptyDescription>从理解库拖入理解，或从工具栏拖入文本</EmptyDescription>
        </EmptyContent>
      </Empty>
    </div>
  );
}

export type CanvasSaveStatusKind = "clean" | "dirty" | "saving" | "error";

export function CanvasSaveStatus({
  saveStatus,
  onRetry,
}: {
  saveStatus: CanvasSaveStatusKind;
  onRetry: () => void;
}) {
  if (saveStatus === "error") {
    return (
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-md border border-destructive/30 bg-background px-3 py-2 text-xs text-destructive shadow-sm">
        <span>画布保存失败，修改仍未保存</span>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          重试
        </Button>
      </div>
    );
  }
  if (saveStatus === "dirty" || saveStatus === "saving") {
    return (
      <div className="absolute right-3 top-3 z-20 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
        未保存
      </div>
    );
  }
  return null;
}
