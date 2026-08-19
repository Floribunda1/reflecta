import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { SimpleMarkdownPreview } from "../editor/simple-markdown-preview";
import { Button } from "../components/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../components/context-menu";
import { cn } from "../lib/utils";
import { CanvasColorSwatches } from "./color-swatches";
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

function nodeStateClass(selected: boolean, dragging: boolean) {
  return cn(
    selected ? "ring-2 ring-ring" : "hover:ring-2 hover:ring-ring/50",
    dragging && "opacity-80",
  );
}

/** 统一连线磁吸点：左 = 入（target），右 = 出（source）。 */
function Harness({ source = true, target = true }: { source?: boolean; target?: boolean }) {
  return (
    <>
      {source ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2 !w-2 transition-transform group-hover/canvas-node:scale-125"
        />
      ) : null}
      {target ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2 !w-2 transition-transform group-hover/canvas-node:scale-125"
        />
      ) : null}
    </>
  );
}

function Resizer({ visible }: { visible: boolean }) {
  const { readonly } = useCanvasShapeData();
  return (
    <NodeResizer
      isVisible={visible && !readonly}
      minWidth={80}
      minHeight={48}
      lineClassName="!border-primary"
      handleClassName="!h-2 !w-2 !border-primary !bg-background"
    />
  );
}

function CanvasNodeToolbar({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <NodeToolbar
      isVisible={visible}
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
}: {
  element: CanvasElementDTO;
  onEdit?: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
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
          <Palette style={{ color: element.props.color }} />
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
      className={cn(CARD, nodeStateClass(props.selected, props.dragging))}
      style={element.props.color ? { borderColor: element.props.color } : undefined}
      tabIndex={0}
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
            <SimpleMarkdownPreview value={ref.body} className="canvas-card-markdown" />
          </div>
        </>
      )}
    </div>
  );
}

/** 文本卡：双击就地编辑（textarea + 预览），失焦保存。纯 React 事件，无引擎冲突。 */
export function TextNode(props: NodeProps<CanvasNode>) {
  const element = props.data.element as CanvasElementDTO;
  const text = element.kind === "text" ? element.props.text : "";
  const { readonly, onElementEdit } = useCanvasShapeData();
  const updateElement = useCanvasElementUpdate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startEditing = () => {
    setDraft(text);
    setEditing(true);
  };
  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft === text) return;
    updateElement({
      ...element,
      props: { ...element.props, text: draft },
    } as CanvasElementDTO);
  };

  return (
    <div
      data-testid="canvas-text-card"
      className={cn(CARD, nodeStateClass(props.selected || editing, props.dragging))}
      style={element.props.color ? { borderColor: element.props.color } : undefined}
      tabIndex={0}
      onDoubleClick={readonly ? undefined : startEditing}
    >
      <CanvasNodeToolbar visible={props.selected && !readonly}>
        <NodeActions element={element} onEdit={() => onElementEdit?.(element) ?? startEditing()} />
      </CanvasNodeToolbar>
      <Resizer visible={props.selected} />
      <Harness />
      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(text);
              setEditing(false);
            }
          }}
          className="nodrag nowheel h-full w-full resize-none bg-transparent p-2 text-xs leading-5 outline-none"
          aria-label="文本卡内容"
        />
      ) : (
        <div className="nowheel min-h-0 flex-1 overflow-y-auto p-2">
          <SimpleMarkdownPreview value={text} className="canvas-card-markdown" />
        </div>
      )}
    </div>
  );
}

/**
 * 组（parent node）：RF 原生子流程。子元素通过 parentId 嵌套、position 相对本节点。
 * 组名双击就地编辑。
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
            className={cn(
              "group/canvas-node flex h-full w-full flex-col overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/50 bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              nodeStateClass(props.selected, props.dragging),
            )}
            style={element.props.color ? { borderColor: element.props.color } : undefined}
            tabIndex={0}
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
              ↗
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
            <NodeActions element={element} onEdit={startEditing} showRemove={false} />
          </CanvasNodeToolbar>
          <Resizer visible={props.selected} />
          <Harness />
          <div
            data-testid="canvas-group-label"
            className="flex shrink-0 cursor-grab items-center gap-1.5 border-b border-muted-foreground/30 bg-muted/40 px-2 py-1"
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
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {label || "未命名组"}
              </span>
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

/** 画布引用卡（强制需求）：展示目标画布标题；点击跳转；目标删除 → 占位。 */
export function CanvasRefNode(props: NodeProps<CanvasNode>) {
  const element = props.data.element as CanvasElementDTO;
  const { referencedCanvases, onCanvasRefClick, onElementEdit, readonly } = useCanvasShapeData();
  const canvasRefId = element.kind === "canvas_ref" ? element.canvasRefId : null;
  const target = canvasRefId ? referencedCanvases.get(canvasRefId) : undefined;
  const deleted = !target || target.deleted;

  return (
    <button
      type="button"
      data-testid="canvas-canvas-ref-card"
      data-canvas-ref-id={canvasRefId ?? ""}
      className={cn(
        CARD,
        "nodrag nopan cursor-pointer items-center justify-center gap-1.5 p-2 text-center",
        nodeStateClass(props.selected, props.dragging),
      )}
      style={element.props.color ? { borderColor: element.props.color } : undefined}
      tabIndex={0}
      onClick={() => {
        if (!deleted && canvasRefId) onCanvasRefClick?.(canvasRefId);
      }}
      title={deleted ? "目标画布已删除" : "打开引用画布"}
    >
      <CanvasNodeToolbar visible={props.selected && !readonly}>
        <NodeActions element={element} onEdit={() => onElementEdit?.(element)} />
      </CanvasNodeToolbar>
      <Resizer visible={props.selected} />
      <Harness />
      {deleted ? (
        <>
          <LockKeyhole size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">（已删除）</span>
        </>
      ) : (
        <>
          <Link2 size={14} className="text-muted-foreground" />
          <span className="min-w-0 truncate text-xs font-medium">{target.title}</span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <GitBranch size={10} />
            打开画布
          </span>
        </>
      )}
    </button>
  );
}

/** nodeTypes：键与元素 kind 一一对应（组件外层常量，避免 RF 重建）。 */
export const canvasNodeTypes = {
  understanding: UnderstandingNode,
  text: TextNode,
  group: GroupNode,
  canvas_ref: CanvasRefNode,
};
