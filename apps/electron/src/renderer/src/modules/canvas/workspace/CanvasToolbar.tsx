import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  Circle,
  Library,
  PenLine,
  RectangleHorizontal,
  Shapes,
} from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@reflecta/ui/components/tooltip";
import { PageTopBar } from "@renderer/modules/shared/layout/PageTopBar";
import { CANVAS_ROUTE } from "@renderer/modules/shared/navigation";
import type { CanvasDTO } from "@reflecta/server";
import { useNavigate } from "react-router-dom";
import { errorMessage } from "@renderer/utils/errors";
import { useRenameCanvasMutation } from "../queries";
import { newGroupElement, newShapeElement, newTextElement } from "./element-factory";

const DND_MIME = "application/reflecta-canvas-element";

/** 工具栏拖入源：HTML5 drag，把元素 DTO 写入 dataTransfer，由画布 onDrop 落点。 */
function DndSource({
  label,
  testId,
  icon,
  createElement,
}: {
  label: string;
  testId: string;
  icon: React.ReactNode;
  createElement: () => ReturnType<typeof newTextElement>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            data-testid={testId}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(DND_MIME, JSON.stringify(createElement()));
              event.dataTransfer.effectAllowed = "move";
            }}
          >
            {icon}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * 工作区顶部工具栏：返回列表 + 画布标题就地编辑 + 「理解库」/「引用画布」入口 +
 * 文本 / 矩形 / 圆形 / 组 拖入源。
 */
export function CanvasToolbar({
  canvas,
  libraryOpen,
  onToggleLibrary,
  onOpenCanvasRefPicker,
}: {
  canvas: CanvasDTO | null;
  libraryOpen: boolean;
  onToggleLibrary: () => void;
  onOpenCanvasRefPicker: () => void;
}) {
  const navigate = useNavigate();
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
      toast.error("重命名失败", { description: errorMessage(error) });
      setDraftTitle(canvas.title);
    }
  };

  return (
    <PageTopBar testId="canvas-workspace-toolbar">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="返回画布列表"
        data-testid="canvas-workspace-back-button"
        onClick={() => navigate(CANVAS_ROUTE)}
      >
        <ArrowLeft size={16} />
      </Button>

      <input
        data-testid="canvas-workspace-title-input"
        value={draftTitle}
        onChange={(event) => setDraftTitle(event.target.value)}
        onBlur={() => void commitTitle()}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        aria-label="画布标题"
        className="h-8 w-56 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium outline-none transition-colors hover:border-border focus:border-border"
      />

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <DndSource
        label="文本"
        testId="canvas-tool-dnd-text"
        icon={<PenLine size={15} />}
        createElement={newTextElement}
      />
      <DndSource
        label="矩形"
        testId="canvas-tool-dnd-rect"
        icon={<RectangleHorizontal size={15} />}
        createElement={() => newShapeElement("rect")}
      />
      <DndSource
        label="圆形"
        testId="canvas-tool-dnd-circle"
        icon={<Circle size={15} />}
        createElement={() => newShapeElement("circle")}
      />
      <DndSource
        label="组"
        testId="canvas-tool-dnd-group"
        icon={<Shapes size={15} />}
        createElement={newGroupElement}
      />

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <Button
        type="button"
        size="sm"
        variant={libraryOpen ? "secondary" : "ghost"}
        data-testid="canvas-toggle-library-button"
        onClick={onToggleLibrary}
      >
        <Library size={14} />
        理解库
      </Button>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        data-testid="canvas-open-canvasref-picker"
        onClick={onOpenCanvasRefPicker}
      >
        <BookOpen size={14} />
        引用画布
      </Button>
    </PageTopBar>
  );
}
