import { useQuery } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { UnderstandingSummaryDTO } from "@shared/understanding";

export function useUnderstandingsQuery(selectedDomainIds: string[], showAllDescendants: boolean) {
  const sortedDomainKey = [...selectedDomainIds].sort().join(",");

  return useQuery({
    queryKey: ["understanding.listUnderstandings", sortedDomainKey, showAllDescendants] as const,
    queryFn: async (): Promise<UnderstandingSummaryDTO[]> => {
      const filter = {
        domainIds: selectedDomainIds.length > 0 ? selectedDomainIds : undefined,
        includeDescendants: selectedDomainIds.length > 0 ? showAllDescendants : undefined,
      };

      return ipcClient.understanding.listUnderstandings({
        ...filter,
      });
    },
  });
}
