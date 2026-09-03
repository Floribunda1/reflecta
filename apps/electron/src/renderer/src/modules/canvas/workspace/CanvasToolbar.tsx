import { useEffect, useState } from "react";
import { toast } from "@reflecta/ui/components/toast";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Download, MessageCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@reflecta/ui/components/dropdown-menu";
import { PageTopBar } from "@renderer/modules/shared/layout/PageTopBar";
import type { CanvasDTO } from "@reflecta/shared";
import { renderError } from "@renderer/lib/errors";
import { useRenameCanvasMutation } from "../queries";

/**
 * 工作区顶部工具栏：返回列表 + 画布标题就地编辑；右上角 more（⋯）菜单
 * 收纳导出 PNG 等二级操作。
 */
export function CanvasToolbar({
  canvas,
  onExportPng,
  onChat,
}: {
  canvas: CanvasDTO | null;
  onExportPng: () => void;
  onChat: () => void;
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
      toast.add({ title: "重命名失败", description: renderError(error), type: "error" });
      setDraftTitle(canvas.title);
    }
  };

  return (
    <PageTopBar
      testId="canvas-workspace-toolbar"
      actions={
        <div className="flex items-center gap-3">
          {canvas ? (
            <span
              data-testid="canvas-toolbar-times"
              title={`创建于 ${canvas.createdAt} · 更新于 ${canvas.updatedAt}`}
              className="hidden text-xs whitespace-nowrap text-muted-foreground sm:inline"
            >
              {canvasTimesLabel(canvas)}
            </span>
          ) : null}
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
              <DropdownMenuItem data-testid="canvas-chat-ai" onClick={onChat}>
                <MessageCircle size={14} />
                和 AI 聊聊
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="canvas-export-png" onClick={onExportPng}>
                <Download size={14} />
                导出 PNG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
        className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none outline-none focus-visible:ring-0"
      />
    </PageTopBar>
  );
}

/** 创建用短日期（跨年加年份），更新用相对时间：与理解详情 / 库面板的「更新于 …」语言一致。 */
function canvasTimesLabel(canvas: CanvasDTO): string {
  const created = new Date(canvas.createdAt);
  const createdText =
    created.getFullYear() === new Date().getFullYear()
      ? format(created, "M月d日", { locale: zhCN })
      : format(created, "yyyy年M月d日", { locale: zhCN });
  const updatedText = formatDistanceToNow(new Date(canvas.updatedAt), {
    addSuffix: true,
    locale: zhCN,
  });
  return `创建于 ${createdText} · 更新于 ${updatedText}`;
}
