import { useState } from "react";
import type { Edge } from "@antv/x6";
import { RotateCcw, X } from "lucide-react";
import { applyEdgeStyle, EDGE_COLOR_PALETTE } from "@reflecta/ui/canvas";
import { Button } from "@reflecta/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@reflecta/ui/components/native-select";
import { cn } from "@reflecta/ui/lib/utils";
import type { CanvasEdgeStyle } from "@reflecta/ui/canvas";

/**
 * 连线样式面板（M4-7 / T5 方案 ①）：选中连线 → 右面板详情槽位渲染样式表单。
 * 读 X6 边 data 的 style 写回；每次变更经事件桥 → 防抖 saveCanvas 持久化；一键重置回默认。
 */
export function CanvasEdgeStylePanel({
  edge,
  onClose,
}: {
  edge: Edge | null;
  onClose: () => void;
}) {
  const initial: CanvasEdgeStyle = edge?.getData<{ style?: CanvasEdgeStyle | null }>().style ?? {};
  const [style, setStyle] = useState<CanvasEdgeStyle>(initial);

  if (!edge) return null;

  const update = (patch: Partial<CanvasEdgeStyle>) => {
    const next = { ...style, ...patch };
    setStyle(next);
    applyEdgeStyle(edge, isEmpty(next) ? null : next);
  };

  const reset = () => {
    setStyle({});
    applyEdgeStyle(edge, null);
  };

  return (
    <aside
      data-testid="canvas-edge-style-panel"
      className="flex h-full w-72 shrink-0 flex-col border-l bg-background"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <span className="text-sm font-medium">连线样式</span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="关闭连线样式"
          data-testid="canvas-edge-style-close"
          className="ml-auto"
          onClick={onClose}
        >
          <X size={15} />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        <StyleRow label="拐点">
          <NativeSelect
            size="sm"
            value={style.routing ?? "straight"}
            onChange={(event) =>
              update({ routing: event.target.value as CanvasEdgeStyle["routing"] })
            }
            data-testid="edge-style-routing"
            className="w-full"
          >
            <NativeSelectOption value="straight">直线</NativeSelectOption>
            <NativeSelectOption value="curve">曲线</NativeSelectOption>
            <NativeSelectOption value="orthogonal">正交</NativeSelectOption>
          </NativeSelect>
        </StyleRow>

        <StyleRow label="线型">
          <NativeSelect
            size="sm"
            value={style.lineStyle ?? "solid"}
            onChange={(event) =>
              update({ lineStyle: event.target.value as CanvasEdgeStyle["lineStyle"] })
            }
            data-testid="edge-style-linestyle"
            className="w-full"
          >
            <NativeSelectOption value="solid">实线</NativeSelectOption>
            <NativeSelectOption value="dashed">虚线</NativeSelectOption>
            <NativeSelectOption value="dotted">点线</NativeSelectOption>
          </NativeSelect>
        </StyleRow>

        <StyleRow label="粗细">
          <NativeSelect
            size="sm"
            value={style.width ?? "medium"}
            onChange={(event) => update({ width: event.target.value as CanvasEdgeStyle["width"] })}
            data-testid="edge-style-width"
            className="w-full"
          >
            <NativeSelectOption value="thin">细</NativeSelectOption>
            <NativeSelectOption value="medium">中</NativeSelectOption>
            <NativeSelectOption value="thick">粗</NativeSelectOption>
          </NativeSelect>
        </StyleRow>

        <StyleRow label="箭头">
          <NativeSelect
            size="sm"
            value={style.arrowhead ?? "arrow"}
            onChange={(event) =>
              update({ arrowhead: event.target.value as CanvasEdgeStyle["arrowhead"] })
            }
            data-testid="edge-style-arrowhead"
            className="w-full"
          >
            <NativeSelectOption value="arrow">箭头</NativeSelectOption>
            <NativeSelectOption value="block">三角</NativeSelectOption>
            <NativeSelectOption value="none">无</NativeSelectOption>
          </NativeSelect>
        </StyleRow>

        <StyleRow label="颜色">
          <div className="flex items-center gap-1.5">
            {(Object.keys(EDGE_COLOR_PALETTE) as Array<keyof typeof EDGE_COLOR_PALETTE>).map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`颜色 ${key}`}
                  data-testid={`edge-style-color-${key}`}
                  className={cn(
                    "size-5 rounded-full border",
                    (style.color ?? "default") === key ? "border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: EDGE_COLOR_PALETTE[key] }}
                  onClick={() => update({ color: key })}
                />
              ),
            )}
          </div>
        </StyleRow>

        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="edge-style-reset"
            onClick={reset}
          >
            <RotateCcw size={14} />
            一键重置
          </Button>
        </div>
      </div>
    </aside>
  );
}

function StyleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function isEmpty(style: CanvasEdgeStyle): boolean {
  return (
    Object.keys(style).filter((k) => style[k as keyof CanvasEdgeStyle] !== undefined).length === 0
  );
}
