import { Layers, PanelsTopLeft } from "lucide-react";
import type { CanvasDetailDTO, CanvasEdgeDTO, CanvasElementDTO } from "@reflecta/server";
import { UnderstandingCard } from "@reflecta/ui/capture";
import { cn } from "@reflecta/ui/lib/utils";
import { WIREFRAME_UNDERSTANDINGS } from "./wireframe-data";
import { elementRect, edgeAnchors, curvePath } from "./canvas-geometry";

/**
 * 画布线框 · 画布元素渲染（理解卡 / 文本 / 形状 / 组 / 画布引用）+ 连线层。
 *
 * 说明：
 * - 理解卡复用真实 UnderstandingCard 组件（数据为 mock），保持与 Capture 一致的语言。
 * - 元素交互（线框级）：单击选中（驱动右侧详情）、canvas_ref 双击跳转目标画布；
 *   右键统一拦截，避免误触组件自带菜单。
 */

export type ElementSelectionCallbacks = {
  onSelect: (elementId: string) => void;
};

function preventContextMenu(event: React.MouseEvent) {
  event.preventDefault();
}

function UnderstandingNode({
  element,
  selected,
  onSelect,
}: {
  element: Extract<CanvasElementDTO, { kind: "understanding" }>;
  selected: boolean;
  onSelect: () => void;
}) {
  const view = element.understandingId
    ? WIREFRAME_UNDERSTANDINGS[element.understandingId]
    : undefined;
  if (!view) return null;
  return (
    <div
      className={cn(
        "size-full rounded-xl transition-shadow",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
      onContextMenu={preventContextMenu}
    >
      <UnderstandingCard
        understanding={view}
        selected={selected}
        actionsDisabled
        onSelect={onSelect}
        onAction={() => undefined}
      />
    </div>
  );
}

function TextNode({
  element,
  selected,
  onSelect,
}: {
  element: Extract<CanvasElementDTO, { kind: "text" }>;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex size-full items-start rounded-lg bg-muted/50 px-2.5 py-2 text-left text-sm text-foreground/90 whitespace-pre-wrap transition-shadow outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
      onContextMenu={preventContextMenu}
      onClick={onSelect}
    >
      {element.props.text}
    </button>
  );
}

function ShapeNode({
  element,
  selected,
  onSelect,
}: {
  element: Extract<CanvasElementDTO, { kind: "shape" }>;
  selected: boolean;
  onSelect: () => void;
}) {
  const circle = element.props.shapeType === "circle";
  return (
    <button
      type="button"
      className={cn(
        "flex size-full items-center justify-center border bg-card text-xs text-muted-foreground transition-shadow outline-none hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring",
        circle ? "rounded-full" : "rounded-lg",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
      onContextMenu={preventContextMenu}
      onClick={onSelect}
    >
      {circle ? "异常重试" : "调度"}
    </button>
  );
}

function CanvasRefNode({
  element,
  detail,
  selected,
  onSelect,
  onJump,
}: {
  element: Extract<CanvasElementDTO, { kind: "canvas_ref" }>;
  detail: CanvasDetailDTO;
  selected: boolean;
  onSelect: () => void;
  onJump: () => void;
}) {
  const target = detail.referencedCanvases.find((canvas) => canvas.id === element.canvasRefId);
  return (
    <button
      type="button"
      className={cn(
        "flex size-full flex-col items-start justify-center gap-1 rounded-xl border border-dashed bg-card px-3 py-2 text-left transition-shadow outline-none hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
      onContextMenu={preventContextMenu}
      onClick={onSelect}
      onDoubleClick={onJump}
      title={`双击跳转到 "${target?.title ?? "目标画布"}"`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <PanelsTopLeft size={13} />
        画布引用
      </span>
      <span className="min-w-0 truncate text-sm font-medium text-foreground">
        {target?.title ?? "目标画布"}
      </span>
    </button>
  );
}

function GroupNode({
  canvasId,
  group,
  detail,
  selected,
  selectedElementId,
  onSelect,
  onJumpCanvas,
}: {
  canvasId: string;
  group: Extract<CanvasElementDTO, { kind: "group" }>;
  detail: CanvasDetailDTO;
  selected: boolean;
  selectedElementId: string | null;
  onSelect: (elementId: string) => void;
  onJumpCanvas: (canvasId: string) => void;
}) {
  const children = detail.elements.filter((element) => element.parentId === group.id);
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card/40 transition-shadow",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
      onContextMenu={preventContextMenu}
      onClick={(event) => {
        // 点组内空白选中组
        if (event.target === event.currentTarget) onSelect(group.id);
      }}
    >
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b px-2.5 text-xs font-medium text-foreground/80">
        <Layers size={13} className="text-muted-foreground" />
        {group.props.label}
      </div>
      <div className="relative min-h-0 flex-1">
        {children.map((child) => (
          <div
            key={child.id}
            className="absolute"
            style={{
              left: child.x - group.x,
              top: child.y - group.y,
              width: child.width,
              height: child.height,
            }}
          >
            <RenderedElement
              canvasId={canvasId}
              element={child}
              detail={detail}
              selected={child.id === selectedElementId}
              selectedElementId={selectedElementId}
              onSelect={onSelect}
              onJumpCanvas={onJumpCanvas}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 按 kind 分发渲染（顶层与组内共用）。 */
export function RenderedElement({
  canvasId,
  element,
  detail,
  selected,
  selectedElementId,
  onSelect,
  onJumpCanvas,
}: {
  canvasId: string;
  element: CanvasElementDTO;
  detail: CanvasDetailDTO;
  selected: boolean;
  selectedElementId: string | null;
  onSelect: (elementId: string) => void;
  onJumpCanvas: (canvasId: string) => void;
}) {
  const common = {
    selected,
    onSelect: () => onSelect(element.id),
  };
  switch (element.kind) {
    case "understanding":
      return <UnderstandingNode element={element} {...common} />;
    case "text":
      return <TextNode element={element} {...common} />;
    case "shape":
      return <ShapeNode element={element} {...common} />;
    case "canvas_ref":
      return (
        <CanvasRefNode
          element={element}
          detail={detail}
          {...common}
          onJump={() => onJumpCanvas(element.canvasRefId ?? "")}
        />
      );
    case "group":
      return (
        <GroupNode
          canvasId={canvasId}
          group={element}
          detail={detail}
          selected={selected}
          selectedElementId={selectedElementId}
          onSelect={onSelect}
          onJumpCanvas={onJumpCanvas}
        />
      );
  }
}

// ─── 连线层 ────────────────────────────────────────────────────────────────────

const EDGE_ARROW_MARKER = "wireframe-edge-arrow";

/** 连线锚点缓存的 key（源:目标） */
function edgeAnchorKey(edge: CanvasEdgeDTO): string {
  return `${edge.sourceElementId}:${edge.targetElementId}`;
}

export function EdgeLayer({
  detail,
  selectedElementId,
}: {
  detail: CanvasDetailDTO;
  selectedElementId: string | null;
}) {
  const elementsById = new Map(
    detail.elements.map((element) => [element.id, elementRect(element)] as const),
  );
  const anchors = new Map<
    string,
    { start: { x: number; y: number }; end: { x: number; y: number } }
  >();
  for (const edge of detail.edges) {
    const source = elementsById.get(edge.sourceElementId);
    const target = elementsById.get(edge.targetElementId);
    if (!source || !target) continue;
    anchors.set(edgeAnchorKey(edge), edgeAnchors(source, target));
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      // viewBox 固定为世界尺寸（外层世界 div 已按视口 scale/translate）
      viewBox="0 0 3200 2400"
      aria-hidden
    >
      <defs>
        <marker
          id={EDGE_ARROW_MARKER}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--foreground)" fillOpacity="0.5" />
        </marker>
      </defs>
      {detail.edges.map((edge) => {
        const anchor = anchors.get(edgeAnchorKey(edge));
        if (!anchor) return null;
        const involved =
          edge.sourceElementId === selectedElementId || edge.targetElementId === selectedElementId;
        const curve = edge.style?.routing === "curve" ? 0.25 : 0;
        const d =
          curve === 0
            ? `M ${anchor.start.x} ${anchor.start.y} L ${anchor.end.x} ${anchor.end.y}`
            : curvePath(anchor.start, anchor.end, curve);
        const dashed = edge.style?.lineStyle === "dashed";
        const mid = {
          x: (anchor.start.x + anchor.end.x) / 2,
          y: (anchor.start.y + anchor.end.y) / 2,
        };
        return (
          <g key={edge.id}>
            <path
              d={d}
              markerEnd={`url(#${EDGE_ARROW_MARKER})`}
              fill="none"
              className="stroke-foreground"
              strokeOpacity={involved ? 0.75 : 0.4}
              strokeWidth={1.5}
              strokeDasharray={dashed ? "6 5" : undefined}
            />
            {edge.label ? (
              <text
                x={mid.x}
                y={mid.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                fontSize={12}
                style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 4 }}
              >
                {edge.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
