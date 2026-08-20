import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, MoreHorizontal } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@reflecta/ui/components/dropdown-menu";
import { PageTopBar } from "@renderer/modules/shared/layout/PageTopBar";
import type { CanvasDTO } from "@reflecta/server";
import { renderError } from "@renderer/lib/errors";
import { useRenameCanvasMutation } from "../queries";

/**
 * 工作区顶部工具栏：返回列表 + 画布标题就地编辑；右上角 more（⋯）菜单
 * 收纳导出 PNG 等二级操作。
 */
export function CanvasToolbar({
  canvas,
  onExportPng,
}: {
  canvas: CanvasDTO | null;
  onExportPng: () => void;
}) {
  const renameCanvas = useRenameCanvasMutation();
  const [draftTitle, setDraftTitle] = useState("");

  useEffect(() => {
    setDraftTitle(canvas?.title ?? "");
  }, [canvas?.title]);

  const commitTitle = async () => {
    if (!canvas) return;
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === canvas.title) {
      setDraftTitle(canvas.title);
      return;
    }
    try {
      await renameCanvas.mutateAsync({ id: canvas.id, input: { title: trimmed } });
    } catch (error) {
      toast.error("重命名失败", { description: renderError(error) });
      setDraftTitle(canvas.title);
    }
  };

  return (
    <PageTopBar
      testId="canvas-workspace-toolbar"
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="更多"
                data-testid="canvas-toolbar-more"
              />
            }
          >
            <MoreHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-testid="canvas-export-png" onClick={onExportPng}>
              <Download size={14} />
              导出 PNG
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <input
        data-testid="canvas-workspace-title-input"
        value={draftTitle}
        onChange={(event) => setDraftTitle(event.target.value)}
        onBlur={() => void commitTitle()}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        aria-label="画布标题"
        className="h-8 w-auto min-w-0 max-w-[min(520px,100%)] border-0 bg-transparent px-0 text-sm font-medium shadow-none outline-none focus-visible:ring-0"
      />
    </PageTopBar>
  );
}
