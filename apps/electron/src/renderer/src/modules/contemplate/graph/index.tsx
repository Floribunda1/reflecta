/** Graph canvas powered by AntV G6 with ForceAtlas2 layout. */
import { useDeferredValue, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import { GitBranch } from "lucide-react";
import { useContemplatePageContext } from "../context";
import { useThoughtsQuery } from "./useThoughtsQuery";
import { useGraphRenderer } from "./useGraphRenderer";
import { NodePopover } from "./NodePopover";
import { filterThoughtsByStatus } from "./data";
import { GraphLegend } from "./Legend";

export function GraphCanvas() {
  const ctx = useContemplatePageContext();
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const deferredSearchQuery = useDeferredValue(ctx.searchQuery);
  const { data: rawThoughts } = useThoughtsQuery(
    ctx.selectedCategoryIds,
    ctx.showAllDescendants,
    deferredSearchQuery,
  );
  const thoughts = useMemo(
    () => (rawThoughts ? filterThoughtsByStatus(rawThoughts, ctx.statusFilter) : undefined),
    [rawThoughts, ctx.statusFilter],
  );
  const { hoveredNodeId, cursorPos, nodeDataCache } = useGraphRenderer(
    containerRef,
    ctx,
    thoughts,
    resolvedTheme,
  );
  const hovered = hoveredNodeId ? nodeDataCache.get(hoveredNodeId) : null;
  const showPopover = !ctx.selectedThoughtId && !!(hovered && (hovered.title || hovered.body));
  const hasActiveFilter =
    ctx.selectedCategoryIds.length > 0 ||
    ctx.searchQuery.trim().length > 0 ||
    ctx.statusFilter !== "all";
  const isEmpty = thoughts && thoughts.length === 0;

  return (
    <>
      <div ref={containerRef} className="contemplate-canvas h-full w-full" />
      <GraphLegend />
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <div className="mb-3 flex justify-center text-muted-foreground">
              <GitBranch size={34} />
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {hasActiveFilter ? "当前筛选没有匹配的 Thought" : "还没有 Thought"}
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {hasActiveFilter ? "调整搜索、状态或 Category 筛选。" : "在左上角新建节点。"}
            </div>
          </div>
        </div>
      )}
      {showPopover && <NodePopover data={hovered!} x={cursorPos.x} y={cursorPos.y} />}
    </>
  );
}
