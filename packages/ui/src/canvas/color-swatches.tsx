import { Button } from "../components/button";
import { ToggleGroup, ToggleGroupItem } from "../components/toggle-group";
import { cn } from "../lib/utils";

export const CANVAS_SWATCH_TOKENS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

export type CanvasSwatchToken = (typeof CANVAS_SWATCH_TOKENS)[number];

const SWATCH_CLASS = {
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
} as const satisfies Record<CanvasSwatchToken, string>;

const SWATCH_TOKEN_SET = new Set<string>(CANVAS_SWATCH_TOKENS);

/** 色板 token → 可绘 CSS；遗留 hex 原样返回。 */
export function canvasPaintColor(color?: string): string | undefined {
  if (!color) return undefined;
  if (SWATCH_TOKEN_SET.has(color)) return `var(--${color})`;
  return color;
}

/** 色板：颜色画在内部 chip 上，Toggle 自己的 hover/selected 底不会把色值盖掉。 */
export function CanvasColorSwatches({
  value,
  onChange,
  allowClear = false,
}: {
  value?: string;
  onChange: (color?: string) => void;
  allowClear?: boolean;
}) {
  return (
    <>
      <ToggleGroup
        value={value ? [value] : []}
        onValueChange={(next) => {
          const color = next[0];
          if (color) onChange(color);
        }}
        className="nodrag nopan gap-1"
      >
        {CANVAS_SWATCH_TOKENS.map((token) => (
          <ToggleGroupItem
            key={token}
            value={token}
            aria-label={token}
            title={token}
            className="h-6 min-w-6 w-6 rounded-full p-0"
          >
            <span className={cn("size-3.5 rounded-full", SWATCH_CLASS[token])} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {allowClear ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="nodrag nopan"
          aria-label="清除颜色"
          title="清除颜色"
          onClick={() => onChange(undefined)}
        >
          ×
        </Button>
      ) : null}
    </>
  );
}
