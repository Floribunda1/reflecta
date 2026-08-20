import { useCallback } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import { Skeleton } from "@reflecta/ui/components/skeleton";
import { useModal } from "@reflecta/ui/overlays";
import { useNavigateToCanvas } from "@renderer/modules/shared/navigation";
import type { CanvasDTO } from "@reflecta/server";
import { renderError } from "@renderer/lib/errors";
import { useCanvasList, useCreateCanvasMutation } from "../queries";
import { CanvasListRow } from "./CanvasListRow";
import { CanvasRenameModal, useDeleteCanvas } from "./CanvasRenameModal";

function CanvasListSkeleton() {
  return (
    <div className="space-y-1 px-2 py-3" aria-label="加载中">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}

/** 画布列表侧栏：与 Agent 的 thread sidebar 同级，detail 在右侧展开。 */
export function CanvasListPanel({ selectedCanvasId }: { selectedCanvasId: string | null }) {
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
      toast.error("新建画布失败", { description: renderError(error) });
    }
  }, [createCanvas, navigateToCanvas]);

  const handleOpen = useCallback(
    (canvasId: string) => {
      navigateToCanvas(canvasId);
    },
    [navigateToCanvas],
  );

  return (
    <aside
      data-testid="canvas-list-panel"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
    >
      <div className="relative flex h-10 shrink-0 items-center justify-between gap-1 px-5 pr-2">
        <div data-testid="canvas-list-toolbar" className="min-w-0 truncate text-sm font-medium">
          画布
        </div>
        <Button
          data-testid="canvas-create-button"
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="新建画布"
          onClick={() => void handleCreate()}
        >
          <Plus size={16} />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <CanvasListSkeleton />
        ) : !canvases || canvases.length === 0 ? (
          <div className="px-2 py-3 text-xs leading-5 text-muted-foreground">
            <span>还没有画布</span>
          </div>
        ) : (
          <div className="space-y-1 px-2" data-testid="canvas-list">
            {canvases.map((canvas) => (
              <CanvasListRow
                key={canvas.id}
                canvas={canvas}
                active={canvas.id === selectedCanvasId}
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
    </aside>
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
