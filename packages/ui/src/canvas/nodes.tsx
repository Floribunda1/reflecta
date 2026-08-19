import { useEffect, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { FileText, GitBranch, Link2, LockKeyhole, PackageOpen } from "lucide-react";
import { SimpleMarkdownPreview } from "../editor/simple-markdown-preview";
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
  "understanding" | "text" | "shape" | "group" | "canvas_ref"
>;

const CARD =
  "flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm";

/** 统一连线磁吸点：左 = 入（target），右 = 出（source）。 */
function Harness({ source = true, target = true }: { source?: boolean; target?: boolean }) {
  return (
    <>
      {source ? <Handle type="source" position={Position.Right} className="!h-2 !w-2" /> : null}
      {target ? <Handle type="target" position={Position.Left} className="!h-2 !w-2" /> : null}
    </>
  );
}

/** 理解卡（强制需求）：展示引用理解全文；引用删除后显示占位。 */
export function UnderstandingNode(props: NodeProps<CanvasNode>) {
  const element = props.data.element as CanvasElementDTO;
  const { understandingRefs } = useCanvasShapeData();
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
      className={`${CARD} ${props.selected ? "ring-2 ring-ring" : ""} ${props.dragging ? "opacity-80" : ""}`}
    >
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
  const { readonly } = useCanvasShapeData();
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
    updateElement({ ...element, props: { ...element.props, text: draft } } as CanvasElementDTO);
  };

  return (
    <div
      data-testid="canvas-text-card"
      className={`${CARD} ${editing ? "ring-2 ring-ring" : ""} ${props.selected ? "ring-2 ring-ring" : ""} ${props.dragging ? "opacity-80" : ""}`}
      onDoubleClick={readonly ? undefined : startEditing}
    >
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

/** 图形卡：矩形 / 圆形，纯展示。 */
export function ShapeNode(props: NodeProps<CanvasNode>) {
  const element = props.data.element as CanvasElementDTO;
  const shapeType = element.kind === "shape" ? element.props.shapeType : "rect";
  return (
    <div
      data-testid="canvas-shape-card"
      data-shape-type={shapeType}
      className={`${CARD} ${shapeType === "circle" ? "rounded-full" : "rounded-md"} ${props.selected ? "ring-2 ring-ring" : ""} ${props.dragging ? "opacity-80" : ""} bg-muted/40`}
    >
      <Harness />
    </div>
  );
}

/**
 * 组（parent node）：RF 原生子流程。子元素通过 parentId 嵌套、position 相对本节点。
 * 组名双击就地编辑；自身不含连线磁吸点。
 */
export function GroupNode(props: NodeProps<CanvasNode>) {
  const element = props.data.element as CanvasElementDTO;
  const label = element.kind === "group" ? element.props.label : "";
  const { readonly } = useCanvasShapeData();
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
    updateElement({ ...element, props: { ...element.props, label: draft } } as CanvasElementDTO);
  };

  return (
    <div
      data-testid="canvas-group-node"
      data-group-label={label}
      className={`flex h-full w-full flex-col overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/50 bg-muted/10 ${props.selected ? "ring-2 ring-ring" : ""} ${props.dragging ? "opacity-80" : ""}`}
    >
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
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{label || "未命名组"}</span>
        )}
      </div>
      <div className="min-h-0 flex-1" />
    </div>
  );
}

/** 画布引用卡（强制需求）：展示目标画布标题；点击跳转；目标删除 → 占位。 */
export function CanvasRefNode(props: NodeProps<CanvasNode>) {
  const element = props.data.element as CanvasElementDTO;
  const { referencedCanvases, onCanvasRefClick } = useCanvasShapeData();
  const canvasRefId = element.kind === "canvas_ref" ? element.canvasRefId : null;
  const target = canvasRefId ? referencedCanvases.get(canvasRefId) : undefined;
  const deleted = !target || target.deleted;

  return (
    <button
      type="button"
      data-testid="canvas-canvas-ref-card"
      data-canvas-ref-id={canvasRefId ?? ""}
      className={`${CARD} nodrag nopan cursor-pointer items-center justify-center gap-1.5 p-2 text-center ${props.selected ? "ring-2 ring-ring" : ""} ${props.dragging ? "opacity-80" : ""}`}
      onClick={() => {
        if (!deleted && canvasRefId) onCanvasRefClick?.(canvasRefId);
      }}
      title={deleted ? "目标画布已删除" : "打开引用画布"}
    >
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
  shape: ShapeNode,
  group: GroupNode,
  canvas_ref: CanvasRefNode,
};
