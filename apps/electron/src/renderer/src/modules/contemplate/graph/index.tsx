/** Graph canvas powered by AntV G6 with ForceAtlas2 layout. */
import { defineComponent, ref } from "vue";
import { useContemplatePageContext } from "../context";
import { useThoughtsQuery } from "./useThoughtsQuery";
import { useGraphRenderer } from "./useGraphRenderer";
import { NodePopover } from "./NodePopover";

export const GraphCanvas = defineComponent({
  name: "GraphCanvas",
  setup() {
    const ctx = useContemplatePageContext()!;
    const containerRef = ref<HTMLDivElement | null>(null);

    const { data: thoughts } = useThoughtsQuery(ctx.selectedCategoryIds, ctx.showAllDescendants);
    const { hoveredNodeId, cursorPos, nodeDataCache } = useGraphRenderer(
      containerRef,
      ctx,
      thoughts,
    );

    return () => {
      const hovered = hoveredNodeId.value ? nodeDataCache.get(hoveredNodeId.value) : null;
      const showPopover =
        !ctx.selectedThoughtId.value && !!(hovered && (hovered.title || hovered.body));

      return (
        <>
          <div ref={containerRef} class="contemplate-canvas h-full w-full" />
          {thoughts.value && thoughts.value.length === 0 && (
            <div class="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
              <div class="max-w-sm text-center">
                <div class="mb-3 text-3xl text-surface-300">
                  <i class="pi pi-share-alt" />
                </div>
                <div class="text-sm font-medium text-surface-600">当前范围没有 Thought</div>
                <div class="mt-1 text-xs leading-5 text-muted-color">
                  调整 Category 筛选，或在左上角新建节点。
                </div>
              </div>
            </div>
          )}
          {showPopover && (
            <NodePopover data={hovered!} x={cursorPos.value.x} y={cursorPos.value.y} />
          )}
        </>
      );
    };
  },
});
