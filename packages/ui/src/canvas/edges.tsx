import {
  BaseEdge,
  EdgeToolbar,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { Button } from "../components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, CircleDot, Minus, Palette, Spline, Trash2 } from "lucide-react";
import { canvasPaintColor, CanvasColorSwatches } from "./color-swatches";
import { DEFAULT_CANVAS_EDGE_STYLE, type CanvasEdgeDTO, type CanvasEdgeStyle } from "./document";
import { useCanvasEdgeUpdate, useCanvasShapeData } from "./shape-context";

export type CanvasFlowEdge = Edge<{ edge: CanvasEdgeDTO }, "canvas">;

function pathFor(style: CanvasEdgeStyle | null, props: EdgeProps<CanvasFlowEdge>) {
  const options = {
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  };
  if (style?.routing === "straight") return getStraightPath(options);
  if (style?.routing === "orthogonal") return getSmoothStepPath(options);
  return getBezierPath(options);
}

const ROUTING_OPTIONS = [
  { value: "curve", label: "曲线" },
  { value: "straight", label: "直线" },
  { value: "orthogonal", label: "正交" },
] as const;
const LINE_STYLE_OPTIONS = [
  { value: "solid", label: "实线" },
  { value: "dashed", label: "虚线" },
  { value: "dotted", label: "点线" },
] as const;
const WIDTH_OPTIONS = [
  { value: "thin", label: "细" },
  { value: "medium", label: "中" },
  { value: "thick", label: "粗" },
] as const;
const ARROWHEAD_OPTIONS = [
  { value: "arrow", label: "箭头" },
  { value: "block", label: "方块" },
  { value: "none", label: "无" },
] as const;

function EdgeStyleMenu<T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="nodrag nopan"
            aria-label={label}
            title={label}
          />
        }
      >
        {icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="nodrag nopan">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function lineStyle(style: CanvasEdgeStyle | null, selected: boolean) {
  const color = canvasPaintColor(style?.color) ?? "var(--muted-foreground)";
  return {
    // 选中态使用边自身颜色（与卡片 selected 跟随 border 一致）；
    // hover 色由父级 `.react-flow__edge:hover` 写入 --canvas-edge-stroke。
    stroke: selected ? color : `var(--canvas-edge-stroke, ${color})`,
    strokeWidth: selected ? 4 : style?.width === "thick" ? 4 : style?.width === "medium" ? 3 : 2,
    strokeDasharray:
      style?.lineStyle === "dashed" ? "5 5" : style?.lineStyle === "dotted" ? "2 2" : undefined,
  };
}

export function CanvasEdge(props: EdgeProps<CanvasFlowEdge>) {
  const updateEdge = useCanvasEdgeUpdate();
  const { readonly, multiSelected, onCellAction, editingEdgeId, onEdgeEditEnd } =
    useCanvasShapeData();
  const edge = props.data?.edge;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(edge?.label ?? "");

  useEffect(() => setDraft(edge?.label ?? ""), [edge?.label]);
  // 双击连线（React Flow onEdgeDoubleClick → editingEdgeId）或双击标签（下方 label div）都进入编辑。
  useEffect(() => {
    if (!readonly && editingEdgeId && editingEdgeId === edge?.id) setEditing(true);
  }, [editingEdgeId, edge?.id, readonly]);
  if (!edge) return null;
  const [path, labelX, labelY] = pathFor(edge.style, props);

  const endEditing = () => {
    setEditing(false);
    onEdgeEditEnd?.();
  };

  const commit = () => {
    const label = draft.trim() || null;
    if (label !== edge.label) updateEdge({ ...edge, label });
    endEditing();
  };

  const style = edge.style ?? {};
  const current = { ...DEFAULT_CANVAS_EDGE_STYLE, ...style };
  const patchStyle = (patch: CanvasEdgeStyle) =>
    updateEdge({ ...edge, style: { ...style, ...patch } });

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        style={lineStyle(edge.style, Boolean(props.selected))}
        markerEnd={props.markerEnd}
        interactionWidth={props.interactionWidth}
      />
      <EdgeToolbar
        edgeId={props.id}
        x={labelX}
        // 去掉 28px，让工具栏整体抬到边线上方，避免盖住边；
        // z-index 1001：高于被选中的节点（RF 提升选中节点到 1000），工具栏永远置顶。
        y={labelY - 28}
        isVisible={Boolean(props.selected) && !readonly && !multiSelected}
        className="flex gap-1 rounded-md border bg-background p-1 shadow-sm"
        style={{ zIndex: 1001 }}
      >
        {/* 标签编辑走双击连线（React Flow onEdgeDoubleClick → editingEdgeId），工具栏不放重复入口 */}
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="nodrag nopan"
                aria-label="颜色"
                title="颜色"
              />
            }
          >
            <Palette style={{ color: canvasPaintColor(style.color) }} />
          </PopoverTrigger>
          <PopoverContent className="w-auto flex-row items-center" align="center">
            <CanvasColorSwatches value={style.color} onChange={(color) => patchStyle({ color })} />
          </PopoverContent>
        </Popover>
        <EdgeStyleMenu
          label="形状"
          icon={<Spline />}
          value={current.routing ?? "curve"}
          options={ROUTING_OPTIONS}
          onChange={(routing) => patchStyle({ routing })}
        />
        <EdgeStyleMenu
          label="线型"
          icon={<CircleDot />}
          value={current.lineStyle ?? "solid"}
          options={LINE_STYLE_OPTIONS}
          onChange={(nextLineStyle) => patchStyle({ lineStyle: nextLineStyle })}
        />
        <EdgeStyleMenu
          label="线宽"
          icon={<Minus />}
          value={current.width ?? "thin"}
          options={WIDTH_OPTIONS}
          onChange={(width) => patchStyle({ width })}
        />
        <EdgeStyleMenu
          label="箭头"
          icon={<ArrowRight />}
          value={current.arrowhead ?? "arrow"}
          options={ARROWHEAD_OPTIONS}
          onChange={(arrowhead) => patchStyle({ arrowhead })}
        />
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="nodrag nopan text-destructive"
          aria-label="删除连线"
          title="删除连线"
          onClick={() => onCellAction?.({ type: "delete-edge", edgeId: edge.id })}
        >
          <Trash2 />
        </Button>
      </EdgeToolbar>
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan pointer-events-auto absolute rounded bg-background px-1 text-xs text-foreground shadow-sm ${props.selected ? "ring-1 ring-primary" : "hover:ring-1 hover:ring-ring/50"}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          onDoubleClick={readonly ? undefined : () => setEditing(true)}
        >
          {editing ? (
            <input
              autoFocus
              aria-label="连线标签"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") endEditing();
              }}
              className="w-24 bg-transparent outline-none"
            />
          ) : (
            edge.label
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const canvasEdgeTypes = { canvas: CanvasEdge };
