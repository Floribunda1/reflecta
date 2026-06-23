import type { UnderstandingDTO } from "@shared/understanding";
import { useCallback, useEffect, useMemo } from "react";
import {
  useCaptureUnderstandingList,
  useCaptureUnderstandingListTotal,
  useCreateUnderstandingMutation,
  useDeleteUnderstandingMutation,
  type UnderstandingListFilterKey,
  type UnderstandingListTotalKey,
} from "../queries";
import { useCaptureStore } from "../store";
import { sortUnderstandingSummaries } from "./sort";

export function useUnderstandingList() {
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const searchQuery = useCaptureStore((state) => state.searchQuery);
  const includeDescendants = useCaptureStore((state) => state.includeDescendants);
  const understandingListSortBy = useCaptureStore((state) => state.understandingListSortBy);
  const reconcileSelectedUnderstanding = useCaptureStore(
    (state) => state.reconcileSelectedUnderstanding,
  );
  const normalizedSearchQuery = searchQuery.trim();

  const listFilter = useMemo<UnderstandingListFilterKey>(
    () => ({
      selectedDomainId,
      includeDescendants,
      searchQuery: normalizedSearchQuery,
    }),
    [selectedDomainId, includeDescendants, normalizedSearchQuery],
  );

  const totalFilter = useMemo<UnderstandingListTotalKey>(
    () => ({ selectedDomainId, includeDescendants }),
    [selectedDomainId, includeDescendants],
  );

  const { data, isFetching } = useCaptureUnderstandingList(listFilter);
  const { data: totalData } = useCaptureUnderstandingListTotal(totalFilter);
  const displayedUnderstandings = useMemo(
    () => sortUnderstandingSummaries(data ?? [], understandingListSortBy),
    [data, understandingListSortBy],
  );

  useEffect(() => {
    if (isFetching) return;
    reconcileSelectedUnderstanding(
      new Set(displayedUnderstandings.map((understanding) => understanding.id)),
    );
  }, [displayedUnderstandings, isFetching, reconcileSelectedUnderstanding]);

  return {
    displayedUnderstandings,
    totalCount: totalData?.length ?? 0,
    loading: isFetching,
  };
}

export function useUnderstandingListActions() {
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const resetAfterUnderstandingDeleted = useCaptureStore(
    (state) => state.resetAfterUnderstandingDeleted,
  );
  const createUnderstandingMutation = useCreateUnderstandingMutation();
  const deleteUnderstandingMutation = useDeleteUnderstandingMutation();

  const createEmptyUnderstanding = useCallback(async (): Promise<UnderstandingDTO> => {
    const dto = await createUnderstandingMutation.mutateAsync({
      title: "",
      body: "",
      domainIds: selectedDomainId !== "all" ? [selectedDomainId] : [],
    });
    selectUnderstanding(dto.id);
    return dto;
  }, [selectedDomainId, selectUnderstanding, createUnderstandingMutation]);

  const deleteUnderstanding = useCallback(
    async (id: string) => {
      await deleteUnderstandingMutation.mutateAsync(id);
      resetAfterUnderstandingDeleted(id);
    },
    [deleteUnderstandingMutation, resetAfterUnderstandingDeleted],
  );

  return {
    createEmptyUnderstanding,
    deleteUnderstanding,
  };
}
