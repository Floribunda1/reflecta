import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MoreHorizontal, PanelsTopLeft, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@reflecta/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@reflecta/ui/components/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@reflecta/ui/components/empty";
import { Field, FieldGroup, FieldLabel } from "@reflecta/ui/components/field";
import { Input } from "@reflecta/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@reflecta/ui/components/input-group";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import { useModal } from "@reflecta/ui/overlays";
import { cn } from "@reflecta/ui/lib/utils";
import type { CanvasDTO } from "@reflecta/server";
import { useCanvasWireframeStore } from "./wireframe-store";

/**
 * 画布线框 · 左 rail 画布列表（资源列表语义，区别于 Capture 的领域树）。
 * 交互：行点击切换画布；右键 / 行尾 kebab 重命名·删除；顶部新建 + 搜索过滤。
 */

function updatedLabel(canvas: CanvasDTO): string {
  return formatDistanceToNow(new Date(canvas.updatedAt), { addSuffix: true, locale: zhCN });
}

function RenameCanvasDialog({
  canvas,
  onConfirm,
}: {
  canvas: CanvasDTO;
  onConfirm: (title: string) => void;
}) {
  const [title, setTitle] = useState(canvas.title);
  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel>画布名称</FieldLabel>
        <Input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && title.trim()) onConfirm(title.trim());
          }}
          placeholder="画布名称"
        />
      </Field>
    </FieldGroup>
  );
}

export function CanvasSidebar() {
  const canvases = useCanvasWireframeStore((state) => state.canvases);
  const selectedCanvasId = useCanvasWireframeStore((state) => state.selectedCanvasId);
  const selectCanvas = useCanvasWireframeStore((state) => state.selectCanvas);
  const createCanvas = useCanvasWireframeStore((state) => state.createCanvas);
  const renameCanvas = useCanvasWireframeStore((state) => state.renameCanvas);
  const deleteCanvas = useCanvasWireframeStore((state) => state.deleteCanvas);
  const { openModal, closeModal, confirm } = useModal();
  const [keyword, setKeyword] = useState("");

  const visibleCanvases = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return kw ? canvases.filter((canvas) => canvas.title.toLowerCase().includes(kw)) : canvases;
  }, [canvases, keyword]);

  const handleCreate = () => {
    createCanvas();
    toast.success("已新建画布（线框演示数据）");
  };

  const handleRename = (canvas: CanvasDTO) => {
    openModal(
      <RenameCanvasDialog
        canvas={canvas}
        onConfirm={(title) => {
          renameCanvas(canvas.id, title);
          closeModal();
          toast.success("已重命名画布");
        }}
      />,
      { title: "重命名画布" },
    );
  };

  const handleDelete = (canvas: CanvasDTO) => {
    confirm({
      title: "删除画布",
      message: `确定要删除画布 "${canvas.title}" 吗？此操作不可撤销，且不会进入回收站。`,
      acceptLabel: "删除",
      danger: true,
      onAccept: () => {
        deleteCanvas(canvas.id);
        toast.success("画布已删除");
      },
    });
  };

  return (
    <aside
      data-testid="canvas-wireframe-sidebar"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-1 px-5 pr-2">
        <div className="min-w-0 truncate text-sm font-medium">
          画布
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {canvases.length}
          </span>
        </div>
        <Button
          data-no-drag
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="新建画布"
          title="新建画布"
          onClick={handleCreate}
        >
          <Plus size={16} />
        </Button>
      </div>

      <div className="shrink-0 px-3 pb-2">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <Search className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="筛选画布"
          />
        </InputGroup>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {visibleCanvases.length === 0 ? (
          <Empty className="h-full min-h-40 rounded-none border-0">
            <EmptyContent>
              <EmptyMedia variant="icon">
                <PanelsTopLeft />
              </EmptyMedia>
              <EmptyDescription>
                {canvases.length === 0 ? "还没有画布" : "没有匹配的画布"}
              </EmptyDescription>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="flex flex-col gap-0.5 px-2 pb-3">
            {visibleCanvases.map((canvas) => {
              const active = canvas.id === selectedCanvasId;
              return (
                <RowMenu
                  key={canvas.id}
                  onRename={() => handleRename(canvas)}
                  onDelete={() => handleDelete(canvas)}
                >
                  <button
                    type="button"
                    data-testid="canvas-wireframe-sidebar-item"
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "group flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60",
                    )}
                    onClick={() => selectCanvas(canvas.id)}
                  >
                    <PanelsTopLeft
                      size={15}
                      className={cn("shrink-0", active && "text-foreground")}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {canvas.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {updatedLabel(canvas)}
                    </span>
                  </button>
                </RowMenu>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}

/** 行级操作：整行右键菜单 + 行尾 kebab（hover / 选中时可见） */
function RowMenu({
  children,
  onRename,
  onDelete,
}: {
  children: React.ReactNode;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative min-w-0">
      {children}
      <div className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 transition-opacity pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" size="icon-sm" variant="ghost" aria-label="画布操作">
                <MoreHorizontal size={15} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem onClick={onRename}>
              <Pencil size={14} />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 size={14} />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
