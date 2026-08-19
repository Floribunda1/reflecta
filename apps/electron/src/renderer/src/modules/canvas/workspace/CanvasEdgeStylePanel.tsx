import { Button } from "@reflecta/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@reflecta/ui/components/select";
import {
  DEFAULT_CANVAS_EDGE_STYLE,
  type CanvasEdgeDTO,
  type CanvasEdgeStyle,
} from "@reflecta/ui/canvas";

export function CanvasEdgeStylePanel({
  edge,
  onChange,
  onReset,
}: {
  edge: CanvasEdgeDTO;
  onChange: (edge: CanvasEdgeDTO) => void;
  onReset: () => void;
}) {
  const style = edge.style ?? DEFAULT_CANVAS_EDGE_STYLE;
  const update = (next: Partial<CanvasEdgeStyle>) =>
    onChange({ ...edge, style: { ...style, ...next } });

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="canvas-edge-style-panel">
      <div className="text-sm font-medium">连线样式</div>
      <label className="flex items-center justify-between gap-3 text-xs">
        路由
        <Select
          value={style.routing ?? "curve"}
          onValueChange={(value) =>
            update({ routing: (value ?? "curve") as CanvasEdgeStyle["routing"] })
          }
        >
          <SelectTrigger size="sm" data-testid="edge-style-routing">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="curve">曲线</SelectItem>
            <SelectItem value="straight">直线</SelectItem>
            <SelectItem value="orthogonal">正交</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="flex items-center justify-between gap-3 text-xs">
        线型
        <Select
          value={style.lineStyle ?? "solid"}
          onValueChange={(value) =>
            update({ lineStyle: (value ?? "solid") as CanvasEdgeStyle["lineStyle"] })
          }
        >
          <SelectTrigger size="sm" data-testid="edge-style-linestyle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">实线</SelectItem>
            <SelectItem value="dashed">虚线</SelectItem>
            <SelectItem value="dotted">点线</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="flex items-center justify-between gap-3 text-xs">
        粗细
        <Select
          value={style.width ?? "thin"}
          onValueChange={(value) =>
            update({ width: (value ?? "thin") as CanvasEdgeStyle["width"] })
          }
        >
          <SelectTrigger size="sm" data-testid="edge-style-width">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thin">细</SelectItem>
            <SelectItem value="medium">中</SelectItem>
            <SelectItem value="thick">粗</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="flex items-center justify-between gap-3 text-xs">
        箭头
        <Select
          value={style.arrowhead ?? "arrow"}
          onValueChange={(value) =>
            update({ arrowhead: (value ?? "arrow") as CanvasEdgeStyle["arrowhead"] })
          }
        >
          <SelectTrigger size="sm" data-testid="edge-style-arrowhead">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">无</SelectItem>
            <SelectItem value="arrow">箭头</SelectItem>
            <SelectItem value="block">实心箭头</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <div className="flex items-center justify-between gap-3 text-xs">
        颜色
        <div className="flex gap-1" data-testid="edge-style-colors">
          {["#94a3b8", "#3b82f6", "#22c55e", "#ef4444"].map((color) => (
            <Button
              key={color}
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={color}
              data-testid={`edge-style-color-${color.slice(1)}`}
              className="h-6 w-6 rounded-full p-0"
              style={{ backgroundColor: color }}
              onClick={() => update({ color })}
            />
          ))}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        data-testid="edge-style-reset"
        onClick={onReset}
      >
        重置
      </Button>
      <span className="sr-only">当前颜色：{style.color}</span>
    </div>
  );
}
