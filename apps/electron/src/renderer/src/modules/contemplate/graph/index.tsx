/** Graph canvas powered by AntV G6 with ForceAtlas2 layout. */
import { useMemo } from "react";
import { GitBranch } from "lucide-react";
import type { Category } from "@shared/category";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { useContemplatePageContext } from "../context";
import { useThoughtsQuery } from "./useThoughtsQuery";
import { filterThoughtsByStatus } from "./data";
import { OverviewAtlas } from "./OverviewAtlas";
import { NoteCanvas } from "./NoteCanvas";
import { useCaptureCategories } from "../../capture/queries";

export function GraphCanvas() {
  const ctx = useContemplatePageContext();
  const { data: rawThoughts } = useThoughtsQuery(ctx.selectedCategoryIds, ctx.showAllDescendants);
  const { data: allRawThoughts } = useThoughtsQuery([], true);
  const { categoryList } = useCaptureCategories();
  const isOverview = ctx.selectedCategoryIds.length === 0;
  const thoughts = useMemo(
    () => (rawThoughts ? filterThoughtsByStatus(rawThoughts, ctx.statusFilter) : undefined),
    [rawThoughts, ctx.statusFilter],
  );
  const allThoughts = useMemo(
    () => (allRawThoughts ? filterThoughtsByStatus(allRawThoughts, ctx.statusFilter) : undefined),
    [allRawThoughts, ctx.statusFilter],
  );
  const focusThoughts = useMemo(
    () => expandFocusThoughts(thoughts, allThoughts),
    [thoughts, allThoughts],
  );
  const hasActiveFilter = ctx.selectedCategoryIds.length > 0 || ctx.statusFilter !== "all";
  const isEmpty = (isOverview ? allThoughts : focusThoughts)?.length === 0;

  if (isOverview && allThoughts && allThoughts.length > 0) {
    return (
      <OverviewAtlas
        categories={categoryList}
        thoughts={allThoughts}
        onSelectCategory={(categoryId) => ctx.setSelectedCategoryIds([categoryId])}
      />
    );
  }

  return (
    <FocusGraph
      rawThoughts={thoughts}
      thoughts={focusThoughts}
      categories={categoryList}
      hasActiveFilter={hasActiveFilter}
      isEmpty={isEmpty}
    />
  );
}

function expandFocusThoughts(
  focusThoughts: ThoughtSummaryDTO[] | undefined,
  allThoughts: ThoughtSummaryDTO[] | undefined,
) {
  if (!focusThoughts) return undefined;
  if (!allThoughts) return focusThoughts;
  const focusIds = new Set(focusThoughts.map((thought) => thought.id));
  const allById = new Map(allThoughts.map((thought) => [thought.id, thought]));
  const result = new Map(focusThoughts.map((thought) => [thought.id, thought]));

  for (const thought of focusThoughts) {
    for (const id of thought.connectionIds) {
      const external = allById.get(id);
      if (external && !focusIds.has(id)) result.set(id, external);
    }
  }

  for (const thought of allThoughts) {
    if (focusIds.has(thought.id)) continue;
    if (thought.connectionIds.some((id) => focusIds.has(id))) result.set(thought.id, thought);
  }

  return [...result.values()];
}

function FocusGraph({
  rawThoughts,
  thoughts,
  categories,
  hasActiveFilter,
  isEmpty,
}: {
  rawThoughts: ThoughtSummaryDTO[] | undefined;
  thoughts: ThoughtSummaryDTO[] | undefined;
  categories: Category[];
  hasActiveFilter: boolean;
  isEmpty: boolean | undefined;
}) {
  const ctx = useContemplatePageContext();

  return (
    <>
      <div className="contemplate-canvas h-full w-full">
        {thoughts && rawThoughts && thoughts.length > 0 && (
          <NoteCanvas
            thoughts={thoughts}
            focusThoughts={rawThoughts}
            categories={categories}
            selectedThoughtId={ctx.selectedThoughtId}
            onSelectThought={ctx.setSelectedThoughtId}
          />
        )}
      </div>
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
              {hasActiveFilter ? "调整状态或 Category 筛选。" : "在左上角新建节点。"}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
