import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { useLocalStorageState } from "@renderer/modules/shared/hooks/use-local-storage-state";

type ContemplatePageContextValue = {
  selectedCategoryIds: string[];
  setSelectedCategoryIds: (value: string[]) => void;
  selectedThoughtId: string | null;
  setSelectedThoughtId: (value: string | null) => void;
  showAllDescendants: boolean;
  setShowAllDescendants: (value: boolean) => void;
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
    false,
  );

  const value = useMemo(
    () => ({
      selectedCategoryIds,
      setSelectedCategoryIds,
      selectedThoughtId,
      setSelectedThoughtId,
      showAllDescendants,
      setShowAllDescendants,
    }),
    [
      selectedCategoryIds,
      setSelectedCategoryIds,
      selectedThoughtId,
      showAllDescendants,
      setShowAllDescendants,
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
