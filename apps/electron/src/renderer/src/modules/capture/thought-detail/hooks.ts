import type { ContextDTO, CreateContextInput, UpdateContextInput } from "@shared/context";
import type { ThoughtType } from "@shared/thought";
import { useCallback } from "react";
import {
  useCaptureThoughtDetail,
  useCreateContextMutation,
  useDeleteContextMutation,
  useDeleteThoughtMutation,
  useUpdateContextMutation,
  useUpdateThoughtMutation,
} from "../queries";

type UpdateThoughtInput = {
  type?: ThoughtType;
  title?: string | null;
  body?: string;
  categoryIds?: string[];
};

export function useThoughtDetail(thoughtId: string) {
  const { data: thought, isFetching: loading } = useCaptureThoughtDetail(thoughtId);

  return {
    thought: thought ?? null,
    loading,
  };
}

export function useThoughtDetailActions(thoughtId: string) {
  const updateThoughtMutation = useUpdateThoughtMutation();
  const deleteThoughtMutation = useDeleteThoughtMutation();
  const createContextMutation = useCreateContextMutation(thoughtId);
  const updateContextMutation = useUpdateContextMutation(thoughtId);
  const deleteContextMutation = useDeleteContextMutation(thoughtId);

  const updateThought = useCallback(
    (input: UpdateThoughtInput) => updateThoughtMutation.mutateAsync({ id: thoughtId, input }),
    [thoughtId, updateThoughtMutation],
  );

  const deleteThought = useCallback(
    () => deleteThoughtMutation.mutateAsync(thoughtId),
    [thoughtId, deleteThoughtMutation],
  );

  const createContext = useCallback(
    async (input: Omit<CreateContextInput, "thoughtId">): Promise<ContextDTO> =>
      createContextMutation.mutateAsync(input),
    [createContextMutation],
  );

  const updateContext = useCallback(
    (id: string, input: UpdateContextInput) =>
      updateContextMutation.mutateAsync({
        id,
        input: {
          sourceType: input.sourceType,
          sourceName: input.sourceName ?? undefined,
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
    updateThought,
    deleteThought,
    createContext,
    updateContext,
    deleteContext,
  };
}
