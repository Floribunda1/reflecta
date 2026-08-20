import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@reflecta/ui/components/button";
import { DialogFooter } from "@reflecta/ui/components/dialog";
import { Input } from "@reflecta/ui/components/input";
import { Label } from "@reflecta/ui/components/label";
import { useModal } from "@reflecta/ui/overlays";
import type { CanvasDTO } from "@reflecta/server";
import { renderError } from "@renderer/lib/errors";
import { useDeleteCanvasMutation, useRenameCanvasMutation } from "../queries";

/**
 * 重命名画布弹窗内容（M1-2）：就地改名，失焦/确认提交。
 * 标题默认值「未命名画布」，也可在工作区顶部改（落 Phase 1）。
 */
export function CanvasRenameModal({
  canvasId,
  initialTitle,
  onClose,
}: {
  canvasId: string;
  initialTitle: string;
  onClose: () => void;
}) {
  const renameCanvas = useRenameCanvasMutation();
  const [title, setTitle] = useState(initialTitle);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await renameCanvas.mutateAsync({ id: canvasId, input: { title: trimmed } });
      toast.success("已重命名画布");
      onClose();
    } catch (error) {
      toast.error("重命名失败", { description: renderError(error) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>画布名称</Label>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="未命名画布"
          aria-label="画布名称"
          data-testid="canvas-rename-input"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!title.trim()}
          onClick={() => void submit()}
          data-testid="canvas-rename-confirm-button"
        >
          保存
        </Button>
      </DialogFooter>
    </div>
  );
}

/** 删除画布确认（M1-3：硬删不进回收站，提示将删除画布及其全部内容）。 */
export function useDeleteCanvas() {
  const { confirm } = useModal();
  const deleteCanvas = useDeleteCanvasMutation();

  return useCallback(
    (canvas: CanvasDTO) => {
      confirm({
        title: "删除画布",
        message: (
          <>
            将删除画布「{canvas.title}」及其全部内容，且无法恢复（删除为硬删，不进回收站）。
            确定继续吗？
          </>
        ),
        acceptLabel: "删除",
        danger: true,
        onAccept: async () => {
          try {
            await deleteCanvas.mutateAsync(canvas.id);
            toast.success("已删除画布");
          } catch (error) {
            toast.error("删除失败", { description: renderError(error) });
          }
        },
      });
    },
    [confirm, deleteCanvas],
  );
}
