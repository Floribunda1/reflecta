import { createContext, ReactNode, useContext, useMemo } from "react";
import { useLocalStorageState } from "@renderer/modules/shared/hooks/use-local-storage-state";

type CapturePageContextValue = {
  selectedCategoryId: string;
  setSelectedCategoryId: (value: string) => void;
  selectedThoughtId: string | null;
  setSelectedThoughtId: (value: string | null) => void;
  expandedCategoryKeys: Record<string, boolean>;
  setExpandedCategoryKeys: (value: Record<string, boolean>) => void;
};

const CapturePageContext = createContext<CapturePageContextValue | null>(null);

export function CapturePageProvider({ children }: { children: ReactNode }) {
  const [selectedCategoryId, setSelectedCategoryId] = useLocalStorageState(
    "capture:selectedCategoryId",
    "all",
  );
  const [selectedThoughtId, setSelectedThoughtId] = useLocalStorageState<string | null>(
    "capture:selectedThoughtId",
    null,
  );
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useLocalStorageState<
    Record<string, boolean>
  >("capture:expandedCategoryKeys", {});

  const value = useMemo(
    () => ({
      selectedCategoryId,
      setSelectedCategoryId,
      selectedThoughtId,
      setSelectedThoughtId,
      expandedCategoryKeys,
      setExpandedCategoryKeys,
    }),
    [
      selectedCategoryId,
      setSelectedCategoryId,
      selectedThoughtId,
      setSelectedThoughtId,
      expandedCategoryKeys,
      setExpandedCategoryKeys,
    ],
  );

  return <CapturePageContext.Provider value={value}>{children}</CapturePageContext.Provider>;
}

export function useCapturePageContext() {
  const context = useContext(CapturePageContext);
  if (!context) throw new Error("useCapturePageContext must be used within CapturePageProvider");
  return context;
}
