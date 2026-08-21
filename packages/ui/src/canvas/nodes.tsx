import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
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
 * React Flow 自定义节点（nodeTypes）。
 *
 * 全部是纯 React 组件：content 是业务卡片，Handle 提供连线磁吸点；
 * shapeData（理解卡全文 / 引用标题 / 动作）从 context 读取，不做任何引擎 hack。
 */
type CanvasNode = Node<
  { element: CanvasElementDTO },
  "understanding" | "text" | "group" | "canvas_ref"
>;

const CARD =
  "group/canvas-node flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function nodeStateClass(selected: boolean, dragging: boolean, paint?: string) {
  return cn(
    selected
      ? paint
        ? "ring-2"
        : "ring-2 ring-ring"
      : paint
        ? "hover:ring-2"
        : "hover:ring-2 hover:ring-ring/50",
    dragging && "opacity-80",
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

/** 统一连线磁吸点：左 = 入（target），右 = 出（source）。默认隐藏，hover 卡片时显示。 */
function Harness({ source = true, target = true }: { source?: boolean; target?: boolean }) {
  const handleClass = "!h-2 !w-2 opacity-0 transition-opacity group-hover/canvas-node:opacity-100";
  return (
    <>
      {source ? <Handle type="source" position={Position.Right} className={handleClass} /> : null}
      {target ? <Handle type="target" position={Position.Left} className={handleClass} /> : null}
    </>
  );
}

function Resizer({ visible, hideLine = false }: { visible: boolean; hideLine?: boolean }) {
  const { readonly, multiSelected } = useCanvasShapeData();
  return (
    <NodeResizer
      // 多选时不显示每个节点的独立 resize 手柄，避免视觉噪点。
      isVisible={visible && !readonly && !multiSelected}
      minWidth={80}
      minHeight={48}
      lineClassName={hideLine ? "!border-transparent" : "!border-primary"}
      handleClassName="!h-2 !w-2 !border-primary !bg-background"
    />
  );
}

function CanvasNodeToolbar({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const { multiSelected } = useCanvasShapeData();
  return (
    <NodeToolbar
      // 多选时隐藏各节点的独立操作工具栏，统一交给选区工具栏（group/delete）。
      isVisible={visible && !multiSelected}
      className="flex gap-1 rounded-md border bg-background p-1 shadow-sm"
    >
      {children}
    </NodeToolbar>
  );
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

/** 理解卡（强制需求）：展示引用理解全文；引用删除后显示占位。 */
export function UnderstandingNode(props: NodeProps<CanvasNode>) {
  const element = props.data.element as CanvasElementDTO;
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
      className={cn(CARD, nodeStateClass(props.selected, props.dragging, element.props.color))}
      style={nodeColorStyle(element.props.color)}
    >
      <CanvasNodeToolbar visible={props.selected && !readonly}>
        <NodeActions element={element} onEdit={() => onElementEdit?.(element)} />
      </CanvasNodeToolbar>
      <Resizer visible={props.selected} />
      <Harness />
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

/** 文本卡：双击进入 Markdown 编辑器，失焦保存。纯 React 事件，无引擎冲突。 */
export function TextNode(props: NodeProps<CanvasNode>) {
  const element = props.data.element as CanvasElementDTO;
  const text = element.kind === "text" ? element.props.text : "";
  const { readonly, onElementEdit } = useCanvasShapeData();
  const updateElement = useCanvasElementUpdate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const editorRef = useRef<HTMLDivElement>(null);
  // Escape 取消后编辑器卸载会触发 Milkdown onBlur，需要跳过那次提交。
  const skipCommitRef = useRef(false);

  const startEditing = () => {
    setDraft(text);
    setEditing(true);
  };
  useEffect(() => {
    if (!editing) return;
    // Milkdown 基于 ProseMirror 渲染，挂载后聚焦正文区。
    editorRef.current?.querySelector<HTMLElement>(".ProseMirror")?.focus();
  }, [editing]);

  const commit = (markdown: string) => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    setEditing(false);
    if (markdown === text) return;
    updateElement({
      ...element,
      props: { ...element.props, text: markdown },
    } as CanvasElementDTO);
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
      className={cn(
        CARD,
        nodeStateClass(props.selected || editing, props.dragging, element.props.color),
      )}
      style={nodeColorStyle(element.props.color)}

      onDoubleClick={readonly ? undefined : startEditing}
    >
      <CanvasNodeToolbar visible={props.selected && !readonly}>
        <NodeActions element={element} onEdit={() => onElementEdit?.(element) ?? startEditing()} />
      </CanvasNodeToolbar>
      <Resizer visible={props.selected} />
      <Harness />
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

/**
 * 组（parent node）：RF 原生子流程。子元素通过 parentId 嵌套、position 相对本节点。
 * 外壳用 RF 内置 `.react-flow__node-group`；本组件只叠组名 / 工具栏 / handle / resizer。
 */
export function GroupNode(props: NodeProps<CanvasNode>) {
  const element = props.data.element as CanvasElementDTO;
  const label = element.kind === "group" ? element.props.label : "";
  const { readonly, onCellAction } = useCanvasShapeData();
  const updateElement = useCanvasElementUpdate();
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
    updateElement({
      ...element,
      props: { ...element.props, label: draft },
    } as CanvasElementDTO);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            data-testid="canvas-group-node"
            data-group-label={label}
            className="group/canvas-node relative flex h-full w-full flex-col focus-visible:outline-none"
          />
        }
      >
        <>
          <CanvasNodeToolbar visible={props.selected && !readonly}>
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
            <NodeActions element={element} showRemove={false} showEdit={false} />
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
          </CanvasNodeToolbar>
          <Resizer visible={props.selected} hideLine />
          <Harness />
          {/* 悬浮在矩形左上角上边外的组名徽章 */}
          <div
            data-testid="canvas-group-label"
            className="absolute left-1.5 -top-9 z-10 flex max-w-[calc(100%-1rem)] cursor-grab items-center gap-1 rounded-md bg-background px-1.5 py-0.5 text-xs shadow-sm"
            onDoubleClick={readonly ? undefined : startEditing}
          >
            <PackageOpen size={12} className="shrink-0 text-muted-foreground" />
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
          <div className="min-h-0 flex-1" />
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

/**
 * 画布引用卡（强制需求）：内嵌目标画布的实时小型预览；双击打开；目标删除 → 占位。
 * 单击不跳转（避免误触，打开动作收敛到双击）。
 */
export function CanvasRefNode(props: NodeProps<CanvasNode>) {
  const element = props.data.element as CanvasElementDTO;
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
        nodeStateClass(props.selected, props.dragging, element.props.color),
      )}
      style={nodeColorStyle(element.props.color)}

      onDoubleClick={readonly ? undefined : open}
      title={deleted ? "目标画布已删除" : "双击打开引用画布"}
    >
      <CanvasNodeToolbar visible={props.selected && !readonly}>
        <NodeActions element={element} onEdit={() => onElementEdit?.(element)} />
      </CanvasNodeToolbar>
      <Resizer visible={props.selected} />
      <Harness />
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

/** nodeTypes：键与元素 kind 一一对应（组件外层常量，避免 RF 重建）。 */
export const canvasNodeTypes = {
  understanding: UnderstandingNode,
  text: TextNode,
  group: GroupNode,
  canvas_ref: CanvasRefNode,
};
