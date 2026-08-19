import { Button } from "../components/button";
import { ToggleGroup, ToggleGroupItem } from "../components/toggle-group";

export const CANVAS_SWATCH_COLORS = [
  "#94a3b8",
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#eab308",
] as const;

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
        {CANVAS_SWATCH_COLORS.map((color) => (
          <ToggleGroupItem
            key={color}
            value={color}
            aria-label={color}
            title={color}
            className="h-6 min-w-6 w-6 rounded-full p-0 data-[state=on]:ring-2 data-[state=on]:ring-ring"
          >
            <span
              className="size-3.5 rounded-full ring-1 ring-border group-hover/toggle:ring-foreground"
              style={{ backgroundColor: color }}
            />
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
