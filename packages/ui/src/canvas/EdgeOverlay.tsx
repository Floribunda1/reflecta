import { useEffect, useState } from "react";
import type { Edge as X6Edge, Graph } from "@antv/x6";
import { ArrowRight, CircleDot, Minus, Palette, Spline, Trash2 } from "lucide-react";
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
import { DEFAULT_CANVAS_EDGE_STYLE, type CanvasEdgeDTO, type CanvasEdgeStyle } from "./document";

/**
 * 边样式 / 标签 / 删除工具栏：单条边被选中时显示在图形底部中央。
 * 边本身由 X6 navie 渲染（attrs/connector/router/marker），这里只承载业务操作。
 */
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
  const edge = edgeId ? (graph.getCellById(edgeId) as X6Edge | undefined) : undefined;
  const dto: CanvasEdgeDTO | undefined = edge?.getData()?.edge;

  useEffect(() => setLabelDraft(null), [edgeId]);

  if (readonly || !edge || !dto) return null;

  const style = dto.style ?? {};
  const current = { ...DEFAULT_CANVAS_EDGE_STYLE, ...style };
  const patch = (patch: CanvasEdgeStyle) => onUpdate({ ...dto, style: { ...style, ...patch } });
  const commitLabel = () => {
    if (labelDraft === null) return;
    const label = labelDraft.trim() || null;
    if (label !== dto.label) onUpdate({ ...dto, label });
    setLabelDraft(null);
  };

  return (
    <div
      data-testid="canvas-edge-toolbar"
      className="absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-md border bg-background p-1 shadow-sm"
    >
      <span
        data-testid="canvas-edge-label"
        className="mx-1 min-w-24 max-w-48 rounded border border-transparent px-1.5 py-0.5 text-xs outline-none focus:border-border"
        contentEditable
        suppressContentEditableWarning
        aria-label="连线标签"
        onInput={(e) => setLabelDraft(e.currentTarget.textContent ?? "")}
        onBlur={commitLabel}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.preventDefault();
            setLabelDraft(null);
            e.currentTarget.textContent = dto.label ?? "";
            e.currentTarget.blur();
          }
        }}
      >
        {dto.label}
      </span>
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

      <EdgeStyleMenu
        label="形状"
        icon={<Spline />}
        value={current.routing ?? "curve"}
        options={ROUTING_OPTIONS}
        onChange={(routing) => patch({ routing })}
      />
      <EdgeStyleMenu
        label="线型"
        icon={<CircleDot />}
        value={current.lineStyle ?? "solid"}
        options={LINE_STYLE_OPTIONS}
        onChange={(lineStyle) => patch({ lineStyle })}
      />
      <EdgeStyleMenu
        label="线宽"
        icon={<Minus />}
        value={current.width ?? "thin"}
        options={WIDTH_OPTIONS}
        onChange={(width) => patch({ width })}
      />
      <EdgeStyleMenu
        label="箭头"
        icon={<ArrowRight />}
        value={current.arrowhead ?? "arrow"}
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
    </div>
  );
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
