import { Lock } from "lucide-react";
import { cn } from "#lib/utils";

/** 卡片选中态样式（同 Capture 卡片语义：border / bg-card / 选中 ring）。 */
export const CARD_BASE_CLASS =
  "flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm";

export function selectedCardClass(selected: boolean): string {
  return cn(
    selected ? "border-primary ring-2 ring-primary/30" : "hover:border-muted-foreground/40",
  );
}

/** 锁定态角标（C5：呈现状态随 props 走）。 */
export function LockedBadge() {
  return (
    <span
      data-testid="canvas-card-locked"
      className="absolute top-1.5 right-1.5 z-10 flex size-4 items-center justify-center rounded-sm bg-muted/80 text-muted-foreground"
      title="已锁定"
    >
      <Lock size={10} />
    </span>
  );
}
