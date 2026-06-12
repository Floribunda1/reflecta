import { useQuery } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtSummaryDTO } from "@shared/thought";

export function useThoughtsQuery(selectedCategoryIds: string[], showAllDescendants: boolean) {
  const sortedCategoryKey = [...selectedCategoryIds].sort().join(",");

  return useQuery({
    queryKey: ["thought.listThoughts", sortedCategoryKey, showAllDescendants] as const,
    queryFn: async (): Promise<ThoughtSummaryDTO[]> => {
      if (selectedCategoryIds.length === 0) return ipcClient.thought.listThoughts();
      return ipcClient.thought.listThoughts({
        categoryIds: selectedCategoryIds,
        includeDescendants: showAllDescendants,
      });
    },
  });
}
