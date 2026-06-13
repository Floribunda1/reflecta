/** Graph canvas powered by AntV G6 with ForceAtlas2 layout. */
import { useRef } from "react";
import { useTheme } from "next-themes";
import { GitBranch } from "lucide-react";
import { useContemplatePageContext } from "../context";
import { useThoughtsQuery } from "./useThoughtsQuery";
import { useGraphRenderer } from "./useGraphRenderer";
import { NodePopover } from "./NodePopover";

export function GraphCanvas() {
  const ctx = useContemplatePageContext();
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { data: thoughts } = useThoughtsQuery(ctx.selectedCategoryIds, ctx.showAllDescendants);
  const { hoveredNodeId, cursorPos, nodeDataCache } = useGraphRenderer(
    containerRef,
    ctx,
    thoughts,
    resolvedTheme,
  );
  const hovered = hoveredNodeId ? nodeDataCache.get(hoveredNodeId) : null;
  const showPopover = !ctx.selectedThoughtId && !!(hovered && (hovered.title || hovered.body));

  return (
    <>
      <div ref={containerRef} className="contemplate-canvas h-full w-full" />
      {thoughts && thoughts.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <div className="mb-3 flex justify-center text-muted-foreground">
              <GitBranch size={34} />
            </div>
            <div className="text-sm font-medium text-muted-foreground">当前范围没有 Thought</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              调整 Category 筛选，或在左上角新建节点。
            </div>
          </div>
        </div>
      )}
      {showPopover && <NodePopover data={hovered!} x={cursorPos.x} y={cursorPos.y} />}
    </>
  );
}
