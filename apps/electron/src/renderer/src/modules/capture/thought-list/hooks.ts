import type { ThoughtDTO } from "@shared/thought";
import { useCallback, useEffect, useMemo } from "react";
import {
  useCaptureThoughtList,
  useCaptureThoughtListTotal,
  useCreateThoughtMutation,
  useDeleteThoughtMutation,
  type ThoughtListFilterKey,
  type ThoughtListTotalKey,
} from "../queries";
import { useCaptureStore } from "../store";
import { sortThoughtSummaries } from "./sort";

export function useThoughtList() {
  const selectedCategoryId = useCaptureStore((state) => state.selectedCategoryId);
  const searchQuery = useCaptureStore((state) => state.searchQuery);
  const includeDescendants = useCaptureStore((state) => state.includeDescendants);
  const thoughtListSortBy = useCaptureStore((state) => state.thoughtListSortBy);
  const reconcileSelectedThought = useCaptureStore((state) => state.reconcileSelectedThought);
  const normalizedSearchQuery = searchQuery.trim();

  const listFilter = useMemo<ThoughtListFilterKey>(
    () => ({
      selectedCategoryId,
      includeDescendants,
      searchQuery: normalizedSearchQuery,
    }),
    [selectedCategoryId, includeDescendants, normalizedSearchQuery],
  );

  const totalFilter = useMemo<ThoughtListTotalKey>(
    () => ({ selectedCategoryId, includeDescendants }),
    [selectedCategoryId, includeDescendants],
  );

  const { data, isFetching } = useCaptureThoughtList(listFilter);
  const { data: totalData } = useCaptureThoughtListTotal(totalFilter);
  const displayedThoughts = useMemo(
    () => sortThoughtSummaries(data ?? [], thoughtListSortBy),
    [data, thoughtListSortBy],
  );

  useEffect(() => {
    if (isFetching) return;
    reconcileSelectedThought(new Set(displayedThoughts.map((thought) => thought.id)));
  }, [displayedThoughts, isFetching, reconcileSelectedThought]);

  return {
    displayedThoughts,
    totalCount: totalData?.length ?? 0,
    loading: isFetching,
  };
}

export function useThoughtListActions() {
  const selectedCategoryId = useCaptureStore((state) => state.selectedCategoryId);
  const selectThought = useCaptureStore((state) => state.selectThought);
  const resetAfterThoughtDeleted = useCaptureStore((state) => state.resetAfterThoughtDeleted);
  const createThoughtMutation = useCreateThoughtMutation();
  const deleteThoughtMutation = useDeleteThoughtMutation();

  const createEmptyUnderstanding = useCallback(async (): Promise<ThoughtDTO> => {
    const dto = await createThoughtMutation.mutateAsync({
      type: "insight",
      title: "",
      body: "",
      categoryIds: selectedCategoryId !== "all" ? [selectedCategoryId] : [],
    });
    selectThought(dto.id);
    return dto;
  }, [selectedCategoryId, selectThought, createThoughtMutation]);

  const deleteThought = useCallback(
    async (id: string) => {
      await deleteThoughtMutation.mutateAsync(id);
      resetAfterThoughtDeleted(id);
    },
    [deleteThoughtMutation, resetAfterThoughtDeleted],
  );

  return {
    createEmptyUnderstanding,
    deleteThought,
  };
}
