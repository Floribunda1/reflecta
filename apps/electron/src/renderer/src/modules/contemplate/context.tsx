import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useLocalStorageState } from "@renderer/modules/shared/hooks/use-local-storage-state";

export type GraphStatusFilter = "all" | "with-context" | "without-context";

type ContemplatePageContextValue = {
  selectedDomainIds: string[];
  setSelectedDomainIds: (value: string[]) => void;
  selectedUnderstandingId: string | null;
  setSelectedUnderstandingId: (value: string | null) => void;
  showAllDescendants: boolean;
  setShowAllDescendants: (value: boolean) => void;
  statusFilter: GraphStatusFilter;
  setStatusFilter: (value: GraphStatusFilter) => void;
  resetFilters: () => void;
};

const ContemplatePageContext = createContext<ContemplatePageContextValue | null>(null);

export function ContemplatePageProvider({ children }: { children: ReactNode }) {
  const [selectedDomainIds, setSelectedDomainIds] = useLocalStorageState<string[]>(
    "contemplate:selectedDomainIds",
    [],
  );
  const [selectedUnderstandingId, setSelectedUnderstandingId] = useState<string | null>(null);
  const [showAllDescendants, setShowAllDescendants] = useLocalStorageState<boolean>(
    "contemplate:showAllDescendants",
    true,
  );
  const [statusFilter, setStatusFilter] = useState<GraphStatusFilter>("all");

  const resetFilters = useCallback(() => {
    setSelectedDomainIds([]);
    setShowAllDescendants(true);
    setStatusFilter("all");
    setSelectedUnderstandingId(null);
  }, [setSelectedDomainIds, setShowAllDescendants]);

  const value = useMemo(
    () => ({
      selectedDomainIds,
      setSelectedDomainIds,
      selectedUnderstandingId,
      setSelectedUnderstandingId,
      showAllDescendants,
      setShowAllDescendants,
      statusFilter,
      setStatusFilter,
      resetFilters,
    }),
    [
      selectedDomainIds,
      setSelectedDomainIds,
      selectedUnderstandingId,
      showAllDescendants,
      setShowAllDescendants,
      statusFilter,
      resetFilters,
    ],
  );

  return (
    <ContemplatePageContext.Provider value={value}>{children}</ContemplatePageContext.Provider>
  );
}

export function useContemplatePageContext() {
  const context = useContext(ContemplatePageContext);
  if (!context)
    throw new Error("useContemplatePageContext must be used within ContemplatePageProvider");
  return context;
}
