import { useCallback } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@reflecta/ui/components/empty";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import { Skeleton } from "@reflecta/ui/components/skeleton";
import { useModal } from "@reflecta/ui/overlays";
import { PageTopBar } from "@renderer/modules/shared/layout/PageTopBar";
import { useNavigateToCanvas } from "@renderer/modules/shared/navigation";
import type { CanvasDTO } from "@reflecta/server";
import { errorMessage } from "@renderer/utils/errors";
import { useCanvasList, useCreateCanvasMutation } from "../queries";
import { CanvasListRow } from "./CanvasListRow";
import { CanvasRenameModal, useDeleteCanvas } from "./CanvasRenameModal";

function CanvasListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4" aria-label="加载中">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

/**
 * 画布列表页（模块一：M1-1 列表 / M1-2 新建 / M1-3 删除确认 / M1-4 空状态）。
 * 按更新时间倒序；行交互（重命名 / 删除）沿用 shell 语言。
 */
export function CanvasListPage() {
  const { data: canvases, isLoading } = useCanvasList();
  const createCanvas = useCreateCanvasMutation();
  const navigateToCanvas = useNavigateToCanvas();
  const deleteCanvas = useDeleteCanvas();
  const openRenameModal = useRenameCanvasModal();

  const handleCreate = useCallback(async () => {
    try {
      const canvas = await createCanvas.mutateAsync(undefined);
      // M1-2：新建后直接进入画布（默认标题可在工作区顶部改 → Phase 1）
      navigateToCanvas(canvas.id);
    } catch (error) {
      toast.error("新建画布失败", { description: errorMessage(error) });
    }
  }, [createCanvas, navigateToCanvas]);

  const handleOpen = useCallback(
    (canvasId: string) => {
      navigateToCanvas(canvasId);
    },
    [navigateToCanvas],
  );

  return (
    <div
      data-testid="canvas-page"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
    >
      <PageTopBar
        testId="canvas-list-toolbar"
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => void handleCreate()}
            data-testid="canvas-create-button"
          >
            <Plus size={14} />
            新建画布
          </Button>
        }
      >
        <span className="text-sm font-medium">画布</span>
      </PageTopBar>

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <CanvasListSkeleton />
        ) : !canvases || canvases.length === 0 ? (
          <div className="flex h-full min-h-0 items-center justify-center p-6">
            <Empty>
              <EmptyContent>
                <EmptyMedia variant="icon">
                  <Plus />
                </EmptyMedia>
                <EmptyTitle>还没有画布</EmptyTitle>
                <EmptyDescription>
                  画布把你的理解摆成结构：从素材库拖入理解卡，用连线表达「谁推导出谁」。
                </EmptyDescription>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleCreate()}
                  data-testid="canvas-empty-create-button"
                >
                  <Plus size={14} />
                  创建第一张画布
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-4" data-testid="canvas-list">
            {canvases.map((canvas) => (
              <CanvasListRow
                key={canvas.id}
                canvas={canvas}
                actions={{
                  onOpen: handleOpen,
                  onRename: (target) => openRenameModal(target),
                  onDelete: (target) => deleteCanvas(target),
                }}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/** 重命名弹窗入口（useModal().openModal 承载，内容在 CanvasRenameModal）。 */
function useRenameCanvasModal() {
  const { openModal, closeModal } = useModal();
  return useCallback(
    (canvas: CanvasDTO) => {
      openModal(
        <CanvasRenameModal canvasId={canvas.id} initialTitle={canvas.title} onClose={closeModal} />,
        { title: "重命名画布", widthClassName: "max-w-md" },
      );
    },
    [closeModal, openModal],
  );
}
