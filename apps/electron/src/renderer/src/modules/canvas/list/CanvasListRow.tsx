import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MoreHorizontal, PanelsTopLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@reflecta/ui/components/dropdown-menu";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@reflecta/ui/components/item";
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
}: {
  canvas: CanvasDTO;
  actions: CanvasListRowActions;
}) {
  const updatedLabel = formatDistanceToNow(new Date(canvas.updatedAt), {
    addSuffix: true,
    locale: zhCN,
  });

  return (
    <div
      data-testid="canvas-list-row"
      data-canvas-id={canvas.id}
      data-canvas-title={canvas.title}
      className="group/canvas-row flex w-full items-stretch gap-1"
    >
      <Item
        variant="outline"
        render={<button type="button" />}
        className={cn("flex-1 text-left")}
        onClick={() => actions.onOpen(canvas.id)}
      >
        <ItemMedia variant="icon" className="text-muted-foreground">
          <PanelsTopLeft />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="truncate">{canvas.title}</ItemTitle>
          <ItemDescription>更新于 {updatedLabel}</ItemDescription>
        </ItemContent>
      </Item>

      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="canvas-row-menu"
          render={<Button type="button" size="icon-sm" variant="ghost" />}
          className="self-center text-muted-foreground opacity-0 transition-opacity group-hover/canvas-row:opacity-100 group-focus-within/canvas-row:opacity-100"
          aria-label={`画布「${canvas.title}」操作`}
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            data-testid="canvas-row-rename"
            onClick={() => actions.onRename(canvas)}
          >
            <Pencil size={14} />
            重命名
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="canvas-row-delete"
            variant="destructive"
            onClick={() => actions.onDelete(canvas)}
          >
            <Trash2 size={14} />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
