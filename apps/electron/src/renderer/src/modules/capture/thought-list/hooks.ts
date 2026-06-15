import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtDTO, ThoughtSummaryDTO } from "@shared/thought";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { orderBy } from "lodash-es";
import { useCallback, useEffect, useMemo, useRef } from "react";
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

function sortThoughtsByUpdatedAt(items: ThoughtSummaryDTO[]): ThoughtSummaryDTO[] {
  return orderBy(items, [(thought) => new Date(thought.updatedAt).getTime()], ["desc"]);
}

export function orderThoughtsForStableList(
  items: ThoughtSummaryDTO[],
  previousIds?: string[],
): ThoughtSummaryDTO[] {
  const sorted = sortThoughtsByUpdatedAt(items);
  if (!previousIds || previousIds.length === 0) return sorted;

  const previousIndex = new Map(previousIds.map((id, index) => [id, index]));
  const incoming = sorted.filter((item) => !previousIndex.has(item.id));
  const existing = sorted
    .filter((item) => previousIndex.has(item.id))
    .sort((a, b) => previousIndex.get(a.id)! - previousIndex.get(b.id)!);

  return [...incoming, ...existing];
}

export function useThoughtList() {
  const selectedCategoryId = useAtomValue(selectedCategoryIdAtom);
  const searchQuery = useAtomValue(thoughtListSearchQueryAtom);
  const includeDescendants = useAtomValue(thoughtListIncludeDescendantsAtom);
  const previousOrderRef = useRef<{ filterKey: string; ids: string[] } | null>(null);
  const normalizedSearchQuery = searchQuery.trim();
  const filterKey = JSON.stringify([selectedCategoryId, includeDescendants, normalizedSearchQuery]);

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

  const displayedThoughts = useMemo(() => {
    const previous =
      previousOrderRef.current?.filterKey === filterKey ? previousOrderRef.current.ids : undefined;
    return orderThoughtsForStableList(data ?? [], previous);
  }, [data, filterKey]);

  useEffect(() => {
    previousOrderRef.current = {
      filterKey,
      ids: displayedThoughts.map((thought) => thought.id),
    };
  }, [displayedThoughts, filterKey]);

  return {
    displayedThoughts,
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
