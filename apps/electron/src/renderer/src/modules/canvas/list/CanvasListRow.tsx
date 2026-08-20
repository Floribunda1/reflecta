import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@reflecta/ui/components/context-menu";
import { cn } from "@reflecta/ui/lib/utils";
import type { CanvasDTO } from "@reflecta/server";

export type CanvasListRowActions = {
  onOpen: (canvasId: string) => void;
  onRename: (canvas: CanvasDTO) => void;
  onDelete: (canvas: CanvasDTO) => void;
};

/**
 * 画布列表行（M1-1）：标题 + 更新时间和 kebab（重命名 / 删除），
 * 交互沿用 shell 语言（Item 行 + DropdownMenu，与 Capture 领域树同族）。
 */
export function CanvasListRow({
  canvas,
  actions,
  active = false,
}: {
  canvas: CanvasDTO;
  actions: CanvasListRowActions;
  active?: boolean;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Button
            data-testid="canvas-list-row"
            data-canvas-id={canvas.id}
            data-canvas-title={canvas.title}
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "h-8 w-full min-w-0 justify-start px-2.5 text-left font-normal",
              active ? "font-medium" : "text-muted-foreground",
            )}
            onClick={() => actions.onOpen(canvas.id)}
            onContextMenu={() => actions.onOpen(canvas.id)}
          />
        }
      >
        <span className="block min-w-0 flex-1 truncate">{canvas.title}</span>
      </ContextMenuTrigger>
      <ContextMenuContent data-testid="canvas-row-context-menu" className="w-44">
        <ContextMenuItem data-testid="canvas-row-rename" onClick={() => actions.onRename(canvas)}>
          <Pencil />
          重命名
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          data-testid="canvas-row-delete"
          variant="destructive"
          onClick={() => actions.onDelete(canvas)}
        >
          <Trash2 />
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
