import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useLocalStorageState } from "@renderer/modules/shared/hooks/use-local-storage-state";

export type GraphStatusFilter = "all" | "with-context" | "without-context";

type ContemplatePageContextValue = {
  selectedCategoryIds: string[];
  setSelectedCategoryIds: (value: string[]) => void;
  selectedThoughtId: string | null;
  setSelectedThoughtId: (value: string | null) => void;
  showAllDescendants: boolean;
  setShowAllDescendants: (value: boolean) => void;
  statusFilter: GraphStatusFilter;
  setStatusFilter: (value: GraphStatusFilter) => void;
  resetFilters: () => void;
};

const ContemplatePageContext = createContext<ContemplatePageContextValue | null>(null);

export function ContemplatePageProvider({ children }: { children: ReactNode }) {
  const [selectedCategoryIds, setSelectedCategoryIds] = useLocalStorageState<string[]>(
    "contemplate:selectedCategoryIds",
    [],
  );
  const [selectedThoughtId, setSelectedThoughtId] = useState<string | null>(null);
  const [showAllDescendants, setShowAllDescendants] = useLocalStorageState<boolean>(
    "contemplate:showAllDescendants",
    true,
  );
  const [statusFilter, setStatusFilter] = useState<GraphStatusFilter>("all");

  const resetFilters = useCallback(() => {
    setSelectedCategoryIds([]);
    setShowAllDescendants(true);
    setStatusFilter("all");
    setSelectedThoughtId(null);
  }, [setSelectedCategoryIds, setShowAllDescendants]);

  const value = useMemo(
    () => ({
      selectedCategoryIds,
      setSelectedCategoryIds,
      selectedThoughtId,
      setSelectedThoughtId,
      showAllDescendants,
      setShowAllDescendants,
      statusFilter,
      setStatusFilter,
      resetFilters,
    }),
    [
      selectedCategoryIds,
      setSelectedCategoryIds,
      selectedThoughtId,
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
