import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtDTO, ThoughtSummaryDTO } from "@shared/thought";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { orderBy } from "lodash-es";
import { useCallback } from "react";
import {
  selectedCategoryIdAtom,
  selectedThoughtIdAtom,
  thoughtListIncludeDescendantsAtom,
  thoughtListSearchQueryAtom,
} from "../state";

function buildThoughtFilter({
  selectedCategoryId,
  includeDescendants,
  searchQuery,
}: {
  selectedCategoryId: string;
  includeDescendants: boolean;
  searchQuery?: string;
}) {
  const filter: {
    categoryIds?: string[];
    includeDescendants?: boolean;
    searchQuery?: string;
  } = {};

  if (selectedCategoryId !== "all") {
    filter.categoryIds = [selectedCategoryId];
    filter.includeDescendants = includeDescendants;
  }

  const normalizedSearchQuery = searchQuery?.trim();
  if (normalizedSearchQuery) filter.searchQuery = normalizedSearchQuery;

  return Object.keys(filter).length > 0 ? filter : undefined;
}

export function useThoughtList() {
  const selectedCategoryId = useAtomValue(selectedCategoryIdAtom);
  const searchQuery = useAtomValue(thoughtListSearchQueryAtom);
  const includeDescendants = useAtomValue(thoughtListIncludeDescendantsAtom);

  const filter = buildThoughtFilter({
    selectedCategoryId,
    includeDescendants,
    searchQuery,
  });

  const { data, isFetching } = useQuery({
    queryKey: [
      "thought.listThoughts",
      selectedCategoryId,
      includeDescendants,
      searchQuery,
    ] as const,
    queryFn: () => ipcClient.thought.listThoughts(filter),
  });

  const { data: totalData } = useQuery({
    queryKey: ["thought.listThoughts.total", selectedCategoryId, includeDescendants] as const,
    queryFn: () =>
      ipcClient.thought.listThoughts(
        buildThoughtFilter({
          selectedCategoryId,
          includeDescendants,
        }),
      ),
  });

  return {
    displayedThoughts: orderBy(
      data ?? [],
      [(thought: ThoughtSummaryDTO) => new Date(thought.updatedAt).getTime()],
      ["desc"],
    ),
    totalCount: totalData?.length ?? 0,
    loading: isFetching,
  };
}

export function useThoughtListActions() {
  const selectedCategoryId = useAtomValue(selectedCategoryIdAtom);
  const setSelectedThoughtId = useSetAtom(selectedThoughtIdAtom);
  const queryClient = useQueryClient();

  const refreshThoughtLists = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["thought.listThoughts"], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["thought.listThoughts.total"], exact: false }),
      ]),
    [queryClient],
  );

  const createEmptyUnderstanding = useCallback(async (): Promise<ThoughtDTO> => {
    const dto = await ipcClient.thought.createThought({
      type: "insight",
      title: "",
      body: "",
      categoryIds: selectedCategoryId !== "all" ? [selectedCategoryId] : [],
    });
    await refreshThoughtLists();
    setSelectedThoughtId(dto.id);
    return dto;
  }, [selectedCategoryId, setSelectedThoughtId, refreshThoughtLists]);

  const deleteThought = useCallback(
    async (id: string) => {
      await ipcClient.thought.deleteThought(id);
      await refreshThoughtLists();
      setSelectedThoughtId(null);
    },
    [setSelectedThoughtId, refreshThoughtLists],
  );

  return {
    createEmptyUnderstanding,
    deleteThought,
  };
}
