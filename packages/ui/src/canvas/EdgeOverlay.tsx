import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Edge as X6Edge, Graph } from "@antv/x6";
import { ArrowRight, LineStyle, Palette, Route, Trash2, Weight } from "lucide-react";
import { Button } from "../components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import { canvasPaintColor, CanvasColorSwatches } from "./color-swatches";
import {
  DEFAULT_CANVAS_EDGE_STYLE,
  type CanvasEdgeDTO,
  type CanvasEdgePortId,
  type CanvasEdgeStyle,
} from "./document";

/**
 * 边样式 / 标签 / 删除工具栏：单条边被选中时显示在边的路径中点附近。
 * 边本身由 X6 native 渲染（attrs/connector/router/marker），这里只承载业务操作。
 * 样式原地写 cell 时父组件不会重渲染，订阅边的 change 才能跟上色板 / 线型选中态。
 */
function subscribeEdge(edge: X6Edge | undefined, onChange: () => void): () => void {
  if (!edge) return () => {};
  const handler = () => onChange();
  edge.on("change:data", handler);
  edge.on("change:attrs", handler);
  edge.on("change:labels", handler);
  edge.on("change:connector", handler);
  edge.on("change:router", handler);
  return () => {
    edge.off("change:data", handler);
    edge.off("change:attrs", handler);
    edge.off("change:labels", handler);
    edge.off("change:connector", handler);
    edge.off("change:router", handler);
  };
}

export function EdgeOverlay({
  graph,
  edgeId,
  readonly,
  onUpdate,
  onDelete,
}: {
  graph: Graph;
  edgeId: string | null;
  readonly: boolean;
  onUpdate: (edge: CanvasEdgeDTO) => void;
  onDelete: (edgeId: string) => void;
}) {
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const [, refreshPosition] = useState(0);
  const edge = edgeId ? (graph.getCellById(edgeId) as X6Edge | undefined) : undefined;
  const dto = useSyncExternalStore(
    (onChange) => subscribeEdge(edge, onChange),
    () => (edge?.getData() as { edge?: CanvasEdgeDTO } | null | undefined)?.edge,
  );

  useEffect(() => {
    setLabelDraft(null);
    setEditingLabel(false);
  }, [edgeId]);

  useEffect(() => {
    if (!editingLabel) return;
    labelInputRef.current?.focus();
    labelInputRef.current?.select();
  }, [editingLabel]);

  useEffect(() => {
    if (!edge) return;
    const rerender = () => refreshPosition((version) => version + 1);
    graph.on("scale", rerender);
    graph.on("translate", rerender);
    edge.on("change:source", rerender);
    edge.on("change:target", rerender);
    edge.on("change:router", rerender);
    edge.on("change:connector", rerender);
    edge.on("change:vertices", rerender);
    const onLabelDoubleClick = (event: { edge: X6Edge; e: MouseEvent }) => {
      if (event.edge.id !== edge.id) return;
      const target = event.e.target;
      if (!(target instanceof Element) || !target.closest("[data-index]")) return;
      setLabelDraft(dto?.label ?? "");
      setEditingLabel(true);
    };
    graph.on("edge:dblclick", onLabelDoubleClick);
    return () => {
      graph.off("scale", rerender);
      graph.off("translate", rerender);
      edge.off("change:source", rerender);
      edge.off("change:target", rerender);
      edge.off("change:router", rerender);
      edge.off("change:connector", rerender);
      edge.off("change:vertices", rerender);
      graph.off("edge:dblclick", onLabelDoubleClick);
    };
  }, [dto?.label, edge, graph]);

  if (readonly || !edge || !dto) return null;

  const style = dto.style ?? {};
  const current = { ...DEFAULT_CANVAS_EDGE_STYLE, ...style };
  const patch = (patch: CanvasEdgeStyle) => onUpdate({ ...dto, style: { ...style, ...patch } });
  const routing = dto.router?.name ?? dto.connector.name;
  const patchRouting = (name: string) => {
    if (name === "manhattan") {
      const sourcePort = edge.getSourcePortId() as CanvasEdgePortId;
      const targetPort = edge.getTargetPortId() as CanvasEdgePortId;
      onUpdate({
        ...dto,
        router: {
          name,
          args: { padding: 20, startDirections: [sourcePort], endDirections: [targetPort] },
        },
        connector: { name: "rounded", args: { radius: 8 } },
      });
      return;
    }
    if (name === "smooth" || name === "normal") {
      onUpdate({ ...dto, router: null, connector: { name } });
    }
  };
  const commitLabel = () => {
    if (labelDraft === null) return;
    const label = labelDraft.trim() || null;
    if (label !== dto.label) onUpdate({ ...dto, label });
    setLabelDraft(null);
    setEditingLabel(false);
  };
  const cancelLabel = () => {
    setLabelDraft(null);
    setEditingLabel(false);
  };
  const point = graph.localToClient(edge.getConnectionPoint());
  const container = graph.container.getBoundingClientRect();

  return (
    <div
      data-testid="canvas-edge-toolbar"
      className="absolute z-20 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md border bg-background p-1 shadow-sm"
      style={{ left: point.x - container.left, top: point.y - container.top - 8 }}
    >
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
          <CanvasColorSwatches value={style.color} onChange={(color) => patch({ color })} />
        </PopoverContent>
      </Popover>

      <EdgeStyleMenu<string>
        label="形状"
        icon={<Route />}
        value={routing}
        options={ROUTING_OPTIONS}
        onChange={patchRouting}
      />
      <EdgeStyleMenu
        label="线型"
        icon={<LineStyle />}
        value={current.lineStyle ?? "solid"}
        options={LINE_STYLE_OPTIONS}
        onChange={(lineStyle) => patch({ lineStyle })}
      />
      <EdgeStyleMenu
        label="线宽"
        icon={<Weight />}
        value={current.width ?? "thin"}
        options={WIDTH_OPTIONS}
        onChange={(width) => patch({ width })}
      />
      <EdgeStyleMenu
        label="箭头"
        icon={<ArrowRight />}
        value={current.arrowhead ?? "classic"}
        options={ARROWHEAD_OPTIONS}
        onChange={(arrowhead) => patch({ arrowhead })}
      />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="nodrag nopan text-destructive"
        aria-label="删除连线"
        title="删除连线"
        onClick={() => onDelete(dto.id)}
      >
        <Trash2 />
      </Button>
      {editingLabel ? (
        <input
          ref={labelInputRef}
          data-testid="canvas-edge-label"
          value={labelDraft ?? ""}
          className="nodrag nopan absolute left-1/2 top-[calc(100%+0.5rem)] w-40 -translate-x-1/2 rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:border-ring"
          aria-label="连线标签"
          onChange={(event) => setLabelDraft(event.currentTarget.value)}
          onBlur={commitLabel}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.preventDefault();
              cancelLabel();
            }
          }}
        />
      ) : null}
    </div>
  );
}

const ROUTING_OPTIONS = [
  { value: "smooth", label: "曲线" },
  { value: "normal", label: "直线" },
  { value: "manhattan", label: "正交" },
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
  { value: "classic", label: "箭头" },
  { value: "block", label: "方块" },
  { value: "circle", label: "圆点" },
  { value: "diamond", label: "菱形" },
  { value: "cross", label: "十字" },
  { value: "ellipse", label: "椭圆" },
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
  icon: React.ReactNode;
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
