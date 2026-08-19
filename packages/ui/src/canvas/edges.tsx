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
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, CircleDot, Minus, Palette, Trash2, Type } from "lucide-react";
import { CanvasColorSwatches } from "./color-swatches";
import type { CanvasEdgeDTO, CanvasEdgeStyle } from "./document";
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

function lineStyle(style: CanvasEdgeStyle | null, selected: boolean) {
  const color = style?.color ?? "#94a3b8";
  return {
    // --primary 已是 hex，不能包 hsl()，否则 selected stroke 会 IACVT 成 none。
    // hover 色由父级 `.react-flow__edge:hover` 写入 --canvas-edge-stroke。
    stroke: selected ? "var(--primary)" : `var(--canvas-edge-stroke, ${color})`,
    strokeWidth: selected ? 4 : style?.width === "thick" ? 4 : style?.width === "medium" ? 3 : 2,
    strokeDasharray:
      style?.lineStyle === "dashed" ? "5 5" : style?.lineStyle === "dotted" ? "2 2" : undefined,
  };
}

export function CanvasEdge(props: EdgeProps<CanvasFlowEdge>) {
  const edge = props.data?.edge;
  if (!edge) return null;
  const updateEdge = useCanvasEdgeUpdate();
  const { readonly, onCellAction } = useCanvasShapeData();
  const [path, labelX, labelY] = pathFor(edge.style, props);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(edge.label ?? "");

  useEffect(() => setDraft(edge.label ?? ""), [edge.label]);

  const commit = () => {
    setEditing(false);
    const label = draft.trim() || null;
    if (label !== edge.label) updateEdge({ ...edge, label });
  };

  const style = edge.style ?? {};
  const cycle = (key: "routing" | "lineStyle" | "width" | "arrowhead", values: string[]) => {
    const current = style[key] ?? values[0];
    const next = values[(values.indexOf(current) + 1) % values.length];
    updateEdge({ ...edge, style: { ...style, [key]: next } as CanvasEdgeStyle });
  };
  const updateColor = (color?: string) => updateEdge({ ...edge, style: { ...style, color } });

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        style={lineStyle(edge.style, Boolean(props.selected))}
        markerEnd={props.markerEnd}
        interactionWidth={props.interactionWidth}
        onDoubleClick={readonly ? undefined : () => setEditing(true)}
      />
      <EdgeToolbar
        edgeId={props.id}
        x={labelX}
        y={labelY}
        isVisible={Boolean(props.selected) && !readonly}
        className="flex gap-1 rounded-md border bg-background p-1 shadow-sm"
      >
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="nodrag nopan"
          aria-label="编辑标签"
          title="编辑标签"
          onClick={() => setEditing(true)}
        >
          <Type />
        </Button>
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
            <Palette style={{ color: style.color }} />
          </PopoverTrigger>
          <PopoverContent className="w-auto flex-row items-center" align="center">
            <CanvasColorSwatches value={style.color} onChange={updateColor} />
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="nodrag nopan"
          aria-label="切换路由"
          title="切换路由"
          onClick={() => cycle("routing", ["curve", "straight", "orthogonal"])}
        >
          <ArrowRight />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="nodrag nopan"
          aria-label="切换线型"
          title="切换线型"
          onClick={() => cycle("lineStyle", ["solid", "dashed", "dotted"])}
        >
          <CircleDot />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="nodrag nopan"
          aria-label="切换线宽"
          title="切换线宽"
          onClick={() => cycle("width", ["thin", "medium", "thick"])}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="nodrag nopan"
          aria-label="切换箭头"
          title="切换箭头"
          onClick={() => cycle("arrowhead", ["arrow", "block", "none"])}
        >
          <ChevronDown />
        </Button>
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
                if (event.key === "Escape") setEditing(false);
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
