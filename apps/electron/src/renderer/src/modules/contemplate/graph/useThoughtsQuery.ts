import { computed } from "vue";
import type { Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtSummaryDTO } from "@shared/thought";

/**
 * Fetches thoughts for the contemplate graph.
 * Uses the same queryKey as the capture list to share cache.
 */
export function useThoughtsQuery(
  selectedCategoryIds: Ref<string[]>,
  showAllDescendants: Ref<boolean>,
) {
  const queryKey = computed(() => [
    "thought.listThoughts",
    [...selectedCategoryIds.value].sort().join(","),
    showAllDescendants.value,
  ]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ThoughtSummaryDTO[]> => {
      const catIds = selectedCategoryIds.value;
      if (catIds.length === 0) return ipcClient.thought.listThoughts();
      return ipcClient.thought.listThoughts({
        categoryIds: catIds,
        includeDescendants: showAllDescendants.value,
      });
    },
  });
}
