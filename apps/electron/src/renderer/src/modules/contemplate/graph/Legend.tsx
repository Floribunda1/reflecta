import { Link2 } from "lucide-react";

function Dot({ variant }: { variant: "normal" | "selected" | "without-context" | "isolated" }) {
  return (
    <span
      className={
        variant === "selected"
          ? "size-3 rounded-full border-2 border-primary bg-background shadow-[0_0_0_4px_rgb(37_99_235_/_0.12)]"
          : variant === "without-context"
            ? "size-3 rounded-full border-2 border-amber-500 bg-amber-100"
            : variant === "isolated"
              ? "size-3 rounded-full border-2 border-dashed border-muted-foreground bg-background"
              : "size-3 rounded-full border border-border bg-background"
      }
    />
  );
}

export function GraphLegend() {
  return (
    <div className="pointer-events-none absolute right-5 bottom-5 z-10 rounded-md border border-border bg-background/92 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="size-3.5 text-muted-foreground" />
          <span>确认连接</span>
        </div>
        <div className="flex items-center gap-2">
          <Dot variant="selected" />
          <span>当前选中</span>
        </div>
        <div className="flex items-center gap-2">
          <Dot variant="without-context" />
          <span>无 Context</span>
        </div>
        <div className="flex items-center gap-2">
          <Dot variant="isolated" />
          <span>未连接</span>
        </div>
      </div>
    </div>
  );
}
