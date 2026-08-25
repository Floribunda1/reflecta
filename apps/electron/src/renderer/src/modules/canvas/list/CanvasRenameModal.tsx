import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "@reflecta/ui/components/toast";
import { Button } from "@reflecta/ui/components/button";
import { DialogFooter } from "@reflecta/ui/components/dialog";
import { Input } from "@reflecta/ui/components/input";
import { Label } from "@reflecta/ui/components/label";
import { useModal } from "@reflecta/ui/overlays";
import type { CanvasDTO } from "@reflecta/shared";
import { renderError } from "@renderer/lib/errors";
import { CANVAS_ID_QUERY_KEY, CANVAS_ROUTE } from "@renderer/modules/shared/navigation";
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
      toast.add({ title: "已重命名画布", type: "success" });
      onClose();
    } catch (error) {
      toast.add({ title: "重命名失败", description: renderError(error), type: "error" });
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

/** 删除画布确认（M1-3：软删进回收站，可在设置 → 回收站中恢复或永久删除）。 */
export function useDeleteCanvas() {
  const { confirm } = useModal();
  const deleteCanvas = useDeleteCanvasMutation();
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (canvas: CanvasDTO) => {
      confirm({
        title: "删除画布",
        message: (
          <>
            将删除画布「{canvas.title}」及其全部内容，并移入回收站（可在设置 → 回收站中恢复）。
            确定继续吗？
          </>
        ),
        acceptLabel: "删除",
        danger: true,
        onAccept: async () => {
          try {
            await deleteCanvas.mutateAsync(canvas.id);
            // 删除的是当前打开的画布时离开该路由，避免右侧仍显示已删除画布
            const params = new URLSearchParams(location.search);
            if (
              location.pathname === CANVAS_ROUTE &&
              params.get(CANVAS_ID_QUERY_KEY) === canvas.id
            ) {
              navigate(CANVAS_ROUTE);
            }
            toast.add({ title: "已移到回收站", type: "success" });
          } catch (error) {
            toast.add({ title: "删除失败", description: renderError(error), type: "error" });
          }
        },
      });
    },
    [confirm, deleteCanvas, location, navigate],
  );
}
