export function GraphLegend() {
  return (
    <div className="pointer-events-none absolute right-4 bottom-4 z-10 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full border-2 border-amber-500 bg-amber-50" />
        <span>无 Context</span>
      </div>
    </div>
  );
}
