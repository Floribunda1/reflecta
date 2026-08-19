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
import { useEffect, useState } from "react";
import type { CanvasEdgeDTO, CanvasEdgeStyle } from "./document";
import { useCanvasEdgeUpdate } from "./shape-context";

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
  return {
    stroke: selected ? "hsl(var(--primary))" : (style?.color ?? "#94a3b8"),
    strokeWidth: selected ? 4 : style?.width === "thick" ? 4 : style?.width === "medium" ? 3 : 2,
    strokeDasharray:
      style?.lineStyle === "dashed" ? "5 5" : style?.lineStyle === "dotted" ? "2 2" : undefined,
  };
}

export function CanvasEdge(props: EdgeProps<CanvasFlowEdge>) {
  const edge = props.data?.edge;
  if (!edge) return null;
  const updateEdge = useCanvasEdgeUpdate();
  const [path, labelX, labelY] = pathFor(edge.style, props);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(edge.label ?? "");

  useEffect(() => setDraft(edge.label ?? ""), [edge.label]);

  const commit = () => {
    setEditing(false);
    const label = draft.trim() || null;
    if (label !== edge.label) updateEdge({ ...edge, label });
  };

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        style={lineStyle(edge.style, Boolean(props.selected))}
        markerEnd={props.markerEnd}
        interactionWidth={props.interactionWidth}
        onDoubleClick={() => setEditing(true)}
      />
      <EdgeToolbar
        edgeId={props.id}
        x={labelX}
        y={labelY}
        isVisible={Boolean(props.selected)}
        className="flex gap-1 rounded-md border bg-background p-1 shadow-sm"
      >
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="nodrag nopan h-7 px-2 text-xs"
          onClick={() => setEditing(true)}
        >
          编辑标签
        </Button>
      </EdgeToolbar>
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan pointer-events-auto absolute rounded bg-background px-1 text-xs text-foreground shadow-sm ${props.selected ? "ring-1 ring-primary" : ""}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          onDoubleClick={() => setEditing(true)}
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
            (edge.label ?? <span className="text-muted-foreground/60">双击添加标签</span>)
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const canvasEdgeTypes = { canvas: CanvasEdge };
