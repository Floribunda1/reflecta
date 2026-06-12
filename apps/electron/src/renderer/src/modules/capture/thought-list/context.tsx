import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtDTO, ThoughtSummaryDTO } from "@shared/thought";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useCapturePageContext } from "../context";

type ThoughtListContextValue = {
  displayedThoughts: ThoughtSummaryDTO[];
  loading: boolean;
  refresh: () => Promise<unknown>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  createEmptyUnderstanding: () => Promise<ThoughtDTO>;
  deleteThought: (id: string) => Promise<void>;
};

const ThoughtListContext = createContext<ThoughtListContextValue | null>(null);

export function ThoughtListProvider({ children }: { children: ReactNode }) {
  const capture = useCapturePageContext();
  const [searchQuery, setSearchQuery] = useState("");

  const queryKey = ["thought.listThoughts", capture.selectedCategoryId, searchQuery] as const;

  const { data, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => {
      const filter: {
        categoryIds?: string[];
        includeDescendants?: boolean;
        searchQuery?: string;
      } = {};
      if (capture.selectedCategoryId !== "all") {
        filter.categoryIds = [capture.selectedCategoryId];
        filter.includeDescendants = false;
      }
      if (searchQuery) filter.searchQuery = searchQuery;
      return ipcClient.thought.listThoughts(Object.keys(filter).length > 0 ? filter : undefined);
    },
  });

  const displayedThoughts = useMemo(() => {
    return [...(data ?? [])].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [data]);

  const refresh = useCallback(() => refetch(), [refetch]);

  const createEmptyUnderstanding = useCallback(async () => {
    const dto = await ipcClient.thought.createThought({
      type: "insight",
      title: "",
      body: "",
      categoryIds: capture.selectedCategoryId !== "all" ? [capture.selectedCategoryId] : [],
    });
    await refetch();
    capture.setSelectedThoughtId(dto.id);
    return dto;
  }, [capture.selectedCategoryId, capture.setSelectedThoughtId, refetch]);

  const deleteThought = useCallback(
    async (id: string) => {
      await ipcClient.thought.deleteThought(id);
      await refetch();
      capture.setSelectedThoughtId(null);
    },
    [capture.setSelectedThoughtId, refetch],
  );

  const value = useMemo(
    () => ({
      displayedThoughts,
      loading: isFetching,
      refresh,
      searchQuery,
      setSearchQuery,
      createEmptyUnderstanding,
      deleteThought,
    }),
    [displayedThoughts, isFetching, refresh, searchQuery, createEmptyUnderstanding, deleteThought],
  );

  return <ThoughtListContext.Provider value={value}>{children}</ThoughtListContext.Provider>;
}

export function useThoughtListContext() {
  const context = useContext(ThoughtListContext);
  if (!context) throw new Error("useThoughtListContext must be used within ThoughtListProvider");
  return context;
}
