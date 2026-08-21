import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Node as X6Node } from "@antv/x6";
import { register } from "@antv/x6-react-shape";
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
const CanvasReadOnlyView = lazy(() =>
  import("./CanvasReadOnlyView").then((module) => ({ default: module.CanvasReadOnlyView })),
);
import { canvasPaintColor, CanvasColorSwatches } from "./color-swatches";
import type { CanvasElementDTO } from "./document";
import { useCanvasElementUpdate, useCanvasShapeData } from "./shape-context";

/**
 * X6 react-shape 卡片组件。
 *
 * 经 `register({ shape, component })` 注册；component 收到 `{ node, graph }`（react-shape
 * 注入）。卡片渲染在 portal provider 内，React context（shapeData / 回写通道）直接穿透。
 * Handle（磁吸点）由节点 metadata 的 `CANVAS_PORTS` 提供；resize 由 `Transform` 插件接管。
 */

type CardProps = { node: X6Node };

const CARD =
  "group/canvas-node flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

/** 有 paint 时：border、hover/selected ring 与卡片背景都取该色（背景用透明淡色）。 */
function nodeColorStyle(color?: string) {
  const paint = canvasPaintColor(color);
  if (!paint) return undefined;
  return {
    borderColor: paint,
    ["--tw-ring-color" as string]: paint,
    backgroundColor: `color-mix(in srgb, ${paint} 10%, transparent)`,
  } as React.CSSProperties;
}

/** 订阅单元格变更 / 选中，驱动卡片重渲染（react-shape 只按 effect 重渲，这里主动刷新）。 */
function useCellState(node: X6Node | null): { selected: boolean } {
  const [selected, setSelected] = useState<boolean>(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node as any)?.isSelected?.() ?? false,
  );
  const [, force] = useState(0);
  useEffect(() => {
    if (!node) return;
    const onSelected = () => setSelected(true);
    const onUnselected = () => setSelected(false);
    const bump = () => force((n) => n + 1);
    node.on("selected", onSelected);
    node.on("unselected", onUnselected);
    node.on("change:*", bump);
    return () => {
      node.off("selected", onSelected);
      node.off("unselected", onUnselected);
      node.off("change:*", bump);
    };
  }, [node]);
  return { selected };
}

function useCard(node: X6Node): {
  element: CanvasElementDTO;
  selected: boolean;
  update: (element: CanvasElementDTO) => void;
} {
  const update = useCanvasElementUpdate();
  const element = (node.getData() as { element?: CanvasElementDTO } | null)?.element;
  const { selected } = useCellState(node);
  return { element: element ?? ({} as CanvasElementDTO), selected, update };
}

function NodeActions({
  element,
  onEdit,
  onRemove,
  showRemove = true,
  showEdit = true,
}: {
  element: CanvasElementDTO;
  onEdit?: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
  showEdit?: boolean;
}) {
  const updateElement = useCanvasElementUpdate();
  const { onCellAction } = useCanvasShapeData();
  const updateColor = (color?: string) =>
    updateElement({ ...element, props: { ...element.props, color } } as CanvasElementDTO);
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
          <Palette style={{ color: canvasPaintColor(element.props.color) }} />
        </PopoverTrigger>
        <PopoverContent className="w-auto flex-row items-center" align="center">
          <CanvasColorSwatches value={element.props.color} onChange={updateColor} allowClear />
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
          onClick={
            onRemove ?? (() => onCellAction?.({ type: "delete-element", nodeId: element.id }))
          }
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

function ActionBar({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  return visible ? (
    <div className="absolute right-1 top-1 z-10 flex gap-1 rounded-md border bg-background p-1 shadow-sm">
      {children}
    </div>
  ) : null;
}

/** 理解卡：展示引用理解全文；引用删除后显示占位。 */
export function UnderstandingCard({ node }: CardProps) {
  const { element, selected } = useCard(node);
  const { understandingRefs, readonly, onElementEdit } = useCanvasShapeData();
  const ref =
    element.kind === "understanding" && element.understandingId
      ? understandingRefs.get(element.understandingId)
      : undefined;
  const deleted = !ref || ref.deleted;

  return (
    <div
      data-testid="canvas-understanding-card"
      data-understanding-id={
        element.kind === "understanding" ? (element.understandingId ?? "") : ""
      }
      className={cn(CARD, nodeStateClass(selected, element.props.color))}
      style={nodeColorStyle(element.props.color)}
    >
      <ActionBar visible={selected && !readonly}>
        <NodeActions element={element} onEdit={() => onElementEdit?.(element)} />
      </ActionBar>
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
              {ref.title ?? "未命名理解"}
            </span>
          </div>
          <div className="canvas-card-scroll nowheel min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
            <MarkdownPreview value={ref.body} zoomImages={false} />
          </div>
        </>
      )}
    </div>
  );
}

/** 文本卡：双击进入 Markdown 编辑器，失焦保存。 */
export function TextCard({ node }: CardProps) {
  const { element, selected, update } = useCard(node);
  const text = element.kind === "text" ? element.props.text : "";
  const { readonly, onElementEdit } = useCanvasShapeData();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const editorRef = useRef<HTMLDivElement>(null);
  const skipCommitRef = useRef(false);

  const startEditing = () => {
    setDraft(text);
    setEditing(true);
  };
  useEffect(() => {
    if (!editing) return;
    editorRef.current?.querySelector<HTMLElement>(".ProseMirror")?.focus();
  }, [editing]);

  const commit = (markdown: string) => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    setEditing(false);
    if (markdown === text) return;
    update({ ...element, props: { ...element.props, text: markdown } } as CanvasElementDTO);
  };

  const cancel = () => {
    skipCommitRef.current = true;
    setDraft(text);
    setEditing(false);
  };

  return (
    <div
      data-testid="canvas-text-card"
      data-editing={String(editing)}
      className={cn(CARD, nodeStateClass(selected || editing, element.props.color))}
      style={nodeColorStyle(element.props.color)}
      onDoubleClick={readonly ? undefined : startEditing}
    >
      <ActionBar visible={selected && !readonly}>
        <NodeActions element={element} onEdit={() => onElementEdit?.(element) ?? startEditing()} />
      </ActionBar>
      {editing ? (
        <div
          ref={editorRef}
          className="nodrag nopan nowheel min-h-0 flex-1 overflow-y-auto"
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
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

/** 组：外壳矩形 + 组名徽章 + 右键菜单；子元素经 parentId 嵌套。 */
export function GroupCard({ node }: CardProps) {
  const { element, selected, update } = useCard(node);
  const label = element.kind === "group" ? element.props.label : "";
  const { readonly, onCellAction } = useCanvasShapeData();
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
    update({ ...element, props: { ...element.props, label: draft } } as CanvasElementDTO);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            data-testid="canvas-group-node"
            data-group-label={label}
            className={cn(
              "group/canvas-node h-full w-full flex-col overflow-hidden rounded-lg border bg-muted/40",
              "focus-visible:outline-none",
              nodeStateClass(selected, element.props.color),
            )}
            style={nodeColorStyle(element.props.color)}
          />
        }
      >
        <>
          <ActionBar visible={selected && !readonly}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="nodrag nopan"
              aria-label="解组"
              title="解组"
              onClick={() => onCellAction?.({ type: "ungroup", nodeId: element.id })}
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
              onClick={() => onCellAction?.({ type: "delete-group", nodeId: element.id })}
            >
              <Trash2 />
            </Button>
          </ActionBar>
          <div
            data-testid="canvas-group-label"
            className="absolute left-0 -top-6 z-10 flex max-w-[calc(100%-1rem)] cursor-grab items-center gap-1 rounded-md px-1.5 py-0.5 text-xs shadow-sm"
            style={{
              color: canvasPaintColor(element.props.color),
              backgroundColor: "var(--muted)",
            }}
            onDoubleClick={readonly ? undefined : startEditing}
          >
            <PackageOpen size={12} className="shrink-0" />
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
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
        <ContextMenuItem
          data-testid="canvas-group-ungroup"
          disabled={readonly}
          onClick={() => onCellAction?.({ type: "ungroup", nodeId: element.id })}
        >
          解组
        </ContextMenuItem>
        <ContextMenuItem
          data-testid="canvas-group-delete"
          variant="destructive"
          disabled={readonly}
          onClick={() => onCellAction?.({ type: "delete-group", nodeId: element.id })}
        >
          删除组（含组内内容）
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** 画布引用卡：内嵌目标画布小型预览；双击打开；目标删除 → 占位。 */
export function CanvasRefCard({ node }: CardProps) {
  const { element, selected } = useCard(node);
  const { referencedCanvases, onCanvasRefClick, onElementEdit, readonly } = useCanvasShapeData();
  const canvasRefId = element.kind === "canvas_ref" ? element.canvasRefId : null;
  const target = canvasRefId ? referencedCanvases.get(canvasRefId) : undefined;
  const deleted = !target || target.deleted;

  const open = () => {
    if (!deleted && canvasRefId) onCanvasRefClick?.(canvasRefId);
  };

  return (
    <div
      data-testid="canvas-canvas-ref-card"
      data-canvas-ref-id={canvasRefId ?? ""}
      className={cn(
        CARD,
        "relative cursor-pointer overflow-hidden",
        nodeStateClass(selected, element.props.color),
      )}
      style={nodeColorStyle(element.props.color)}
      onDoubleClick={readonly ? undefined : open}
      title={deleted ? "目标画布已删除" : "双击打开引用画布"}
    >
      <ActionBar visible={selected && !readonly}>
        <NodeActions element={element} onEdit={() => onElementEdit?.(element)} />
      </ActionBar>
      {deleted ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-muted-foreground">
          <LockKeyhole size={14} />
          <span className="text-xs">（已删除）</span>
        </div>
      ) : (
        <>
          {target.document ? (
            <div className="pointer-events-none absolute inset-0">
              <Suspense fallback={null}>
                <CanvasReadOnlyView document={target.document} shapeData={target.shapeData} />
              </Suspense>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center">
              <Link2 size={14} className="text-muted-foreground" />
              <span className="min-w-0 truncate text-xs font-medium">{target.title}</span>
            </div>
          )}
          <span className="absolute left-1.5 top-1.5 max-w-[70%] truncate rounded bg-background/80 px-1 text-[10px] font-medium text-foreground">
            {target.title}
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

/** 注册四种 react-shape：键与元素 kind 一一对应（模块加载时幂等注册）。 */
register({ shape: "understanding", component: UnderstandingCard });
register({ shape: "text", component: TextCard });
register({ shape: "group", component: GroupCard });
register({ shape: "canvas_ref", component: CanvasRefCard });
