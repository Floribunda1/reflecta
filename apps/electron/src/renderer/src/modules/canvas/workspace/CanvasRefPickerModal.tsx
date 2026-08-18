import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import { DialogFooter } from "@reflecta/ui/components/dialog";
import { Input } from "@reflecta/ui/components/input";
import { Label } from "@reflecta/ui/components/label";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import type { CanvasDTO } from "@reflecta/server";
import { useCanvasList } from "../queries";

/**
 * 选择目标画布弹窗（M3-E1）：复用画布列表查询；创建画布引用卡。
 * 被选目标画布已删除时卡片显示「（已删除）」占位（M3-E4）。
 */
export function CanvasRefPickerModal({
  excludeCanvasId,
  onPick,
  onClose,
}: {
  excludeCanvasId: string;
  onPick: (canvas: CanvasDTO) => void;
  onClose: () => void;
}) {
  const { data: canvases, isLoading } = useCanvasList();
  const [query, setQuery] = useState("");

  const filtered = (canvases ?? []).filter(
    (canvas) =>
      canvas.id !== excludeCanvasId &&
      (!query.trim() ||
        canvas.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>选择目标画布</Label>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索画布…"
          aria-label="搜索画布"
          data-testid="canvas-ref-picker-search"
          autoFocus
        />
      </div>

      <ScrollArea className="max-h-[50vh]">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">加载中…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">没有可引用的画布</div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((canvas) => (
              <button
                key={canvas.id}
                type="button"
                data-testid="canvas-ref-picker-option"
                data-canvas-id={canvas.id}
                data-canvas-title={canvas.title}
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
                onClick={() => onPick(canvas)}
              >
                <BookOpen size={14} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{canvas.title}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          取消
        </Button>
      </DialogFooter>
    </div>
  );
}
