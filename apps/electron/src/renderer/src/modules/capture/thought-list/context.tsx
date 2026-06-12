import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtDTO, ThoughtSummaryDTO } from "@shared/thought";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { selectedCategoryIdAtom, selectedThoughtIdAtom } from "../state";

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
  const selectedCategoryId = useAtomValue(selectedCategoryIdAtom);
  const setSelectedThoughtId = useSetAtom(selectedThoughtIdAtom);
  const [searchQuery, setSearchQuery] = useState("");

  const queryKey = ["thought.listThoughts", selectedCategoryId, searchQuery] as const;

  const { data, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => {
      const filter: {
        categoryIds?: string[];
        includeDescendants?: boolean;
        searchQuery?: string;
      } = {};
      if (selectedCategoryId !== "all") {
        filter.categoryIds = [selectedCategoryId];
        filter.includeDescendants = false;
      }
      if (searchQuery) filter.searchQuery = searchQuery;
      return ipcClient.thought.listThoughts(Object.keys(filter).length > 0 ? filter : undefined);
    },
  });

  const displayedThoughts = [...(data ?? [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const refresh = useCallback(() => refetch(), [refetch]);

  const createEmptyUnderstanding = useCallback(async () => {
    const dto = await ipcClient.thought.createThought({
      type: "insight",
      title: "",
      body: "",
      categoryIds: selectedCategoryId !== "all" ? [selectedCategoryId] : [],
    });
    await refetch();
    setSelectedThoughtId(dto.id);
    return dto;
  }, [selectedCategoryId, setSelectedThoughtId, refetch]);

  const deleteThought = useCallback(
    async (id: string) => {
      await ipcClient.thought.deleteThought(id);
      await refetch();
      setSelectedThoughtId(null);
    },
    [setSelectedThoughtId, refetch],
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
