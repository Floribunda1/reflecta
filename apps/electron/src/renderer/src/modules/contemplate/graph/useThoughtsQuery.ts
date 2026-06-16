import { useQuery } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtSummaryDTO } from "@shared/thought";

export function useThoughtsQuery(selectedCategoryIds: string[], showAllDescendants: boolean) {
  const sortedCategoryKey = [...selectedCategoryIds].sort().join(",");

  return useQuery({
    queryKey: ["thought.listThoughts", sortedCategoryKey, showAllDescendants] as const,
    queryFn: async (): Promise<ThoughtSummaryDTO[]> => {
      const filter = {
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        includeDescendants: selectedCategoryIds.length > 0 ? showAllDescendants : undefined,
      };

      return ipcClient.thought.listThoughts({
        ...filter,
      });
    },
  });
}
