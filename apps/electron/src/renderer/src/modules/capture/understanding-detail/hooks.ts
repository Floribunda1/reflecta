import type { ContextDTO, CreateContextInput, UpdateContextInput } from "@shared/context";
import { useCallback } from "react";
import {
  useCaptureUnderstandingDetail,
  useCreateContextMutation,
  useDeleteContextMutation,
  useDeleteUnderstandingMutation,
  useUpdateContextMutation,
  useUpdateUnderstandingMutation,
} from "../queries";

type UpdateUnderstandingInput = {
  title?: string | null;
  body?: string;
  domainIds?: string[];
};

export function useUnderstandingDetail(understandingId: string) {
  const { data: understanding, isFetching: loading } =
    useCaptureUnderstandingDetail(understandingId);

  return {
    understanding: understanding ?? null,
    loading,
  };
}

export function useUnderstandingDetailActions(understandingId: string) {
  const updateUnderstandingMutation = useUpdateUnderstandingMutation();
  const deleteUnderstandingMutation = useDeleteUnderstandingMutation();
  const createContextMutation = useCreateContextMutation(understandingId);
  const updateContextMutation = useUpdateContextMutation(understandingId);
  const deleteContextMutation = useDeleteContextMutation(understandingId);

  const updateUnderstanding = useCallback(
    (input: UpdateUnderstandingInput) =>
      updateUnderstandingMutation.mutateAsync({ id: understandingId, input }),
    [understandingId, updateUnderstandingMutation],
  );

  const deleteUnderstanding = useCallback(
    () => deleteUnderstandingMutation.mutateAsync(understandingId),
    [understandingId, deleteUnderstandingMutation],
  );

  const createContext = useCallback(
    async (input: Omit<CreateContextInput, "understandingId">): Promise<ContextDTO> =>
      createContextMutation.mutateAsync(input),
    [createContextMutation],
  );

  const updateContext = useCallback(
    (id: string, input: UpdateContextInput) =>
      updateContextMutation.mutateAsync({
        id,
        input: {
          medium: input.medium,
          title: input.title ?? undefined,
          content: input.content,
        },
      }),
    [updateContextMutation],
  );

  const deleteContext = useCallback(
    (id: string) => deleteContextMutation.mutateAsync(id),
    [deleteContextMutation],
  );

  return {
    updateUnderstanding,
    deleteUnderstanding,
    createContext,
    updateContext,
    deleteContext,
  };
}
