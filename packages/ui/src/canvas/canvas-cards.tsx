import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  FileText,
  GitBranch,
  Link2,
  LockKeyhole,
  PackageOpen,
  Palette,
  Pencil,
  Trash2,
  Ungroup,
} from "lucide-react";
import { MarkdownPreview } from "../editor/markdown-preview";
import { MarkdownEditor } from "../editor/markdown-editor";
import { Button } from "../components/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../components/context-menu";
import { cn } from "../lib/utils";
import { canvasPaintColor, CanvasColorSwatches } from "./color-swatches";
import type { CanvasDocument } from "./document";
import type { CanvasShapeData } from "./shape-context";

const CanvasReadOnlyView = lazy(() =>
  import("./CanvasReadOnlyView").then((module) => ({ default: module.CanvasReadOnlyView })),
);

const CARD =
  "group/canvas-node relative flex h-full w-full flex-col rounded-lg border border-border bg-card text-card-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function nodeStateClass(selected: boolean, paint?: string) {
  return cn(
    selected
      ? paint
        ? "ring-2"
        : "ring-2 ring-ring"
      : paint
        ? "hover:ring-2"
        : "hover:ring-2 hover:ring-ring/50",
  );
}

/**
 * 有 paint 时：border / ring 用该色；背景在不透明底色上混入 10%，避免整张卡变透。
 * 卡片底是 `--card`，组外壳底是 `--muted`。
 */
function nodeColorStyle(color?: string, fill = "var(--card)"): CSSProperties | undefined {
  const paint = canvasPaintColor(color);
  if (!paint) return undefined;
  return {
    borderColor: paint,
    ["--tw-ring-color" as string]: paint,
    backgroundColor: `color-mix(in oklch, ${paint} 10%, ${fill})`,
  };
}

export function CanvasNodeActionBar({
  children,
  visible,
}: {
  children: React.ReactNode;
  visible: boolean;
}) {
  return visible ? (
    <div className="absolute bottom-full left-1/2 z-10 mb-2 flex -translate-x-1/2 gap-1 rounded-md border bg-background p-1 shadow-sm">
      {children}
    </div>
  ) : null;
}

export function CanvasNodeActions({
  color,
  onColorChange,
  onEdit,
  onRemove,
  showRemove = true,
  showEdit = true,
}: {
  color?: string;
  onColorChange?: (color?: string) => void;
  onEdit?: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
  showEdit?: boolean;
}) {
  return (
    <div className="flex gap-1">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="nodrag nopan"
              aria-label="选择颜色"
              title="选择颜色"
            />
          }
        >
          <Palette style={{ color: canvasPaintColor(color) }} />
        </PopoverTrigger>
        <PopoverContent className="w-auto flex-row items-center" align="center">
          <CanvasColorSwatches
            value={color}
            onChange={onColorChange ?? (() => undefined)}
            allowClear
          />
        </PopoverContent>
      </Popover>
      {showRemove ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="nodrag nopan text-destructive"
          aria-label="删除"
          title="删除"
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      ) : null}
      {showEdit ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="nodrag nopan"
          aria-label="编辑"
          title="编辑"
          onClick={onEdit}
          disabled={!onEdit}
        >
          <Pencil />
        </Button>
      ) : null}
    </div>
  );
}

export type CanvasUnderstandingCardProps = {
  id: string;
  title: string | null;
  body: string;
  deleted?: boolean;
  color?: string;
  selected?: boolean;
  readonly?: boolean;
  multiSelected?: boolean;
  understandingId?: string;
  onEdit?: () => void;
  onRemove?: () => void;
  onColorChange?: (color?: string) => void;
  onOpenDetail?: () => void;
};

/** 理解卡：标题 + Markdown 正文；引用删除后显示占位。 */
export function CanvasUnderstandingCard({
  id,
  title,
  body,
  deleted = false,
  color,
  selected = false,
  readonly = false,
  multiSelected = false,
  understandingId = "",
  onEdit,
  onRemove,
  onColorChange,
  onOpenDetail,
}: CanvasUnderstandingCardProps) {
  return (
    <div
      data-testid="canvas-understanding-card"
      data-node-id={id}
      data-understanding-id={understandingId}
      className={cn(CARD, nodeStateClass(selected, color))}
      style={nodeColorStyle(color)}
      onDoubleClick={readonly ? undefined : onOpenDetail}
    >
      <CanvasNodeActionBar visible={selected && !readonly && !multiSelected}>
        <CanvasNodeActions
          color={color}
          onColorChange={onColorChange}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      </CanvasNodeActionBar>
      {deleted ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-muted-foreground">
          <LockKeyhole size={14} />
          <span className="text-xs">（已删除）</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 border-b px-2.5 py-1.5">
            <FileText size={12} className="shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {title ?? "未命名理解"}
            </span>
          </div>
          <div className="canvas-card-scroll nowheel min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
            <MarkdownPreview value={body} zoomImages={false} />
          </div>
        </>
      )}
    </div>
  );
}

export type CanvasTextCardProps = {
  id: string;
  text: string;
  color?: string;
  selected?: boolean;
  readonly?: boolean;
  multiSelected?: boolean;
  onTextChange?: (text: string) => void;
  onColorChange?: (color?: string) => void;
  onRemove?: () => void;
};

/** 文本卡：双击进入 Markdown 编辑器，失焦保存。 */
export function CanvasTextCard({
  id,
  text,
  color,
  selected = false,
  readonly = false,
  multiSelected = false,
  onTextChange,
  onColorChange,
  onRemove,
}: CanvasTextCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const editorRef = useRef<HTMLDivElement>(null);

  const startEditing = () => {
    setDraft(text);
    setEditing(true);
  };
  useEffect(() => {
    if (!editing) return;
    editorRef.current?.querySelector<HTMLElement>(".ProseMirror")?.focus();
  }, [editing]);

  const commit = (markdown: string) => {
    setEditing(false);
    if (markdown === text) return;
    onTextChange?.(markdown);
  };

  return (
    <div
      data-testid="canvas-text-card"
      data-node-id={id}
      data-editing={String(editing)}
      className={cn(CARD, nodeStateClass(selected || editing, color))}
      style={nodeColorStyle(color)}
      onDoubleClick={readonly ? undefined : startEditing}
    >
      <CanvasNodeActionBar visible={selected && !readonly && !multiSelected}>
        <CanvasNodeActions
          color={color}
          onColorChange={onColorChange}
          onEdit={startEditing}
          onRemove={onRemove}
        />
      </CanvasNodeActionBar>
      {editing ? (
        <div
          ref={editorRef}
          className="nodrag nopan nowheel min-h-0 flex-1 overflow-y-auto"
          onKeyDown={(e) => {
            if (e.key === "Escape") commit(draft);
          }}
        >
          <MarkdownEditor
            value={draft}
            height="auto"
            onChange={setDraft}
            onBlur={commit}
            className="px-2 py-1"
          />
        </div>
      ) : (
        <div className="nowheel min-h-0 flex-1 overflow-y-auto p-2">
          <MarkdownPreview value={text} zoomImages={false} />
        </div>
      )}
    </div>
  );
}

export type CanvasGroupCardProps = {
  id: string;
  label: string;
  color?: string;
  selected?: boolean;
  readonly?: boolean;
  multiSelected?: boolean;
  onLabelChange?: (label: string) => void;
  onColorChange?: (color?: string) => void;
  onUngroup?: () => void;
  onDelete?: () => void;
};

/** 组：外壳矩形 + 组名徽章；子元素由画布引擎按 parentId 嵌套。 */
export function CanvasGroupCard({
  id,
  label,
  color,
  selected = false,
  readonly = false,
  multiSelected = false,
  onLabelChange,
  onColorChange,
  onUngroup,
  onDelete,
}: CanvasGroupCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    setDraft(label);
    setEditing(true);
  };
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft === label) return;
    onLabelChange?.(draft);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            data-testid="canvas-group-node"
            data-node-id={id}
            data-group-label={label}
            className={cn(
              "group/canvas-node relative h-full w-full overflow-visible rounded-lg border bg-muted",
              "focus-visible:outline-none",
              nodeStateClass(selected, color),
            )}
            style={nodeColorStyle(color, "var(--muted)")}
          />
        }
      >
        <>
          <CanvasNodeActionBar visible={selected && !readonly && !multiSelected}>
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="nodrag nopan"
                    aria-label="选择颜色"
                    title="选择颜色"
                  />
                }
              >
                <Palette style={{ color: canvasPaintColor(color) }} />
              </PopoverTrigger>
              <PopoverContent className="w-auto flex-row items-center" align="center">
                <CanvasColorSwatches
                  value={color}
                  onChange={onColorChange ?? (() => undefined)}
                  allowClear
                />
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="nodrag nopan"
              aria-label="解组"
              title="解组"
              onClick={onUngroup}
            >
              <Ungroup size={14} />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="nodrag nopan text-destructive"
              aria-label="删除组"
              title="删除组"
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </CanvasNodeActionBar>
          <div
            data-testid="canvas-group-label"
            className="absolute bottom-full left-0 mb-1 z-10 flex max-w-[calc(100%-1rem)] cursor-text items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs shadow-sm"
            style={color ? { color: canvasPaintColor(color) } : undefined}
            onDoubleClick={readonly ? undefined : startEditing}
          >
            <PackageOpen size={12} className="shrink-0" />
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.currentTarget.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setDraft(label);
                    setEditing(false);
                  }
                  if (e.key === "Enter") commit();
                }}
                className="nodrag min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                aria-label="组名"
              />
            ) : (
              <span className="min-w-0 truncate text-xs font-medium">{label || "未命名组"}</span>
            )}
          </div>
        </>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem data-testid="canvas-group-ungroup" disabled={readonly} onClick={onUngroup}>
          解组
        </ContextMenuItem>
        <ContextMenuItem
          data-testid="canvas-group-delete"
          variant="destructive"
          disabled={readonly}
          onClick={onDelete}
        >
          删除组（含组内内容）
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export type CanvasRefCardProps = {
  id: string;
  canvasRefId?: string;
  title: string;
  deleted?: boolean;
  color?: string;
  selected?: boolean;
  readonly?: boolean;
  multiSelected?: boolean;
  document?: CanvasDocument;
  shapeData?: CanvasShapeData;
  onOpen?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  onColorChange?: (color?: string) => void;
};

/** 画布引用卡：内嵌目标画布小型预览；双击打开；目标删除 → 占位。 */
export function CanvasRefCard({
  id,
  canvasRefId = "",
  title,
  deleted = false,
  color,
  selected = false,
  readonly = false,
  multiSelected = false,
  document,
  shapeData,
  onOpen,
  onEdit,
  onRemove,
  onColorChange,
}: CanvasRefCardProps) {
  return (
    <div
      data-testid="canvas-canvas-ref-card"
      data-node-id={id}
      data-canvas-ref-id={canvasRefId}
      className={cn(CARD, "relative cursor-pointer", nodeStateClass(selected, color))}
      style={nodeColorStyle(color)}
      onDoubleClick={readonly ? undefined : onOpen}
      title={deleted ? "目标画布已删除" : "双击打开引用画布"}
    >
      <CanvasNodeActionBar visible={selected && !readonly && !multiSelected}>
        <CanvasNodeActions
          color={color}
          onColorChange={onColorChange}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      </CanvasNodeActionBar>
      {deleted ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-muted-foreground">
          <LockKeyhole size={14} />
          <span className="text-xs">（已删除）</span>
        </div>
      ) : (
        <>
          {document ? (
            <div className="pointer-events-none absolute inset-0">
              <Suspense fallback={null}>
                <CanvasReadOnlyView document={document} shapeData={shapeData} />
              </Suspense>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center">
              <Link2 size={14} className="text-muted-foreground" />
              <span className="min-w-0 truncate text-xs font-medium">{title}</span>
            </div>
          )}
          <span className="absolute left-1.5 top-1.5 max-w-[70%] truncate rounded bg-background/80 px-1 text-[10px] font-medium text-foreground">
            {title}
          </span>
          <span className="absolute right-1.5 bottom-1.5 flex items-center gap-0.5 rounded bg-background/80 px-1 text-[10px] text-muted-foreground">
            <GitBranch size={10} />
            双击打开
          </span>
        </>
      )}
    </div>
  );
}
