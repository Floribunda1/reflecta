import { computed } from "vue";
import type { Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtSummaryDTO } from "@shared/thought";

/**
 * Fetches thoughts for the contemplate graph, handling single and multiple
 * category filters. Multiple categories are fetched in parallel and merged
 * by ID to avoid duplicates.
 */
export function useThoughtsQuery(
  selectedCategoryIds: Ref<string[]>,
  showAllDescendants: Ref<boolean>,
) {
  const queryKey = computed(() => [
    "contemplate.listThoughts",
    [...selectedCategoryIds.value].sort().join(","),
    showAllDescendants.value,
  ]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ThoughtSummaryDTO[]> => {
      const catIds = selectedCategoryIds.value;
      if (catIds.length === 0) return ipcClient.thought.listThoughts();
      if (catIds.length === 1) {
        return ipcClient.thought.listThoughts({
          categoryId: catIds[0],
          includeDescendants: showAllDescendants.value,
        });
      }
      // Multiple categories: fetch in parallel and merge by ID
      const batches = await Promise.all(
        catIds.map((id) =>
          ipcClient.thought.listThoughts({
            categoryId: id,
            includeDescendants: showAllDescendants.value,
          }),
        ),
      );
      const seen = new Set<string>();
      const merged: ThoughtSummaryDTO[] = [];
      for (const batch of batches) {
        for (const t of batch) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            merged.push(t);
          }
        }
      }
      return merged;
    },
  });
}
