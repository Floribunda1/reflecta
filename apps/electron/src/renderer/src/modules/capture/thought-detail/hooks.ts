import { ipcClient } from "@renderer/utils/ipc";
import type { ContextDTO, CreateContextInput, UpdateContextInput } from "@shared/context";
import type { ThoughtDTO, ThoughtSummaryDTO, ThoughtType } from "@shared/thought";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { cloneDeep, debounce } from "lodash-es";
import { useCallback } from "react";

type UpdateThoughtInput = {
  type?: ThoughtType;
  title?: string | null;
  body?: string;
  categoryIds?: string[];
};

const invalidateRelatedThoughtDetails = debounce((queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ["thought.getThoughtById"], exact: false });
}, 800);

function patchThoughtInList(
  thoughtId: string,
  patch: (item: ThoughtSummaryDTO) => ThoughtSummaryDTO,
) {
  return (old: ThoughtSummaryDTO[] | undefined) => {
    if (!old) return old;
    return old.map((item) => (item.id === thoughtId ? patch(item) : item));
  };
}

export function useThoughtDetail(thoughtId: string) {
  const { data: thought, isFetching: loading } = useQuery({
    queryKey: ["thought.getThoughtById", thoughtId],
    queryFn: () => ipcClient.thought.getThoughtById(thoughtId),
  });

  return {
    thought: thought ?? null,
    loading,
  };
}

export function useThoughtDetailActions(thoughtId: string) {
  const queryClient = useQueryClient();

  const updateThought = useCallback(
    async (input: UpdateThoughtInput) => {
      const result = await ipcClient.thought.updateThought(thoughtId, cloneDeep(input));

      queryClient.setQueryData<ThoughtDTO>(["thought.getThoughtById", thoughtId], (old) => {
        if (!old) return old;
        return {
          ...old,
          type: input.type ?? result.type,
          title: input.title !== undefined ? input.title : old.title,
          body: input.body !== undefined ? result.body : old.body,
          categoryIds: input.categoryIds ?? old.categoryIds,
          connections: result.connections,
          referencedBy: result.referencedBy,
          contexts: result.contexts,
          updatedAt: result.updatedAt,
        };
      });

      queryClient.setQueriesData<ThoughtSummaryDTO[]>(
        { queryKey: ["thought.listThoughts"], exact: false },
        patchThoughtInList(thoughtId, (item) => ({
          ...item,
          type: input.type ?? result.type,
          title: input.title !== undefined ? input.title : item.title,
          body: input.body !== undefined ? result.body : item.body,
          categoryIds: input.categoryIds ?? item.categoryIds,
          contextCount: result.contexts.length,
          connectionCount: result.connections.length,
          connectionIds: result.connections.map((connection) => connection.id),
          updatedAt: result.updatedAt,
        })),
      );

      if (input.body !== undefined) {
        invalidateRelatedThoughtDetails(queryClient);
      }
    },
    [thoughtId, queryClient],
  );

  const createContext = useCallback(
    async (input: Omit<CreateContextInput, "thoughtId">): Promise<ContextDTO> => {
      const created = await ipcClient.context.createContext({
        thoughtId,
        sourceType: input.sourceType,
        sourceName: input.sourceName,
        content: input.content,
      });

      queryClient.setQueryData<ThoughtDTO>(["thought.getThoughtById", thoughtId], (old) => {
        if (!old) return old;
        return { ...old, contexts: [...old.contexts, created] };
      });

      queryClient.setQueriesData<ThoughtSummaryDTO[]>(
        { queryKey: ["thought.listThoughts"], exact: false },
        patchThoughtInList(thoughtId, (item) => ({
          ...item,
          contextCount: item.contextCount + 1,
        })),
      );

      return created;
    },
    [thoughtId, queryClient],
  );

  const updateContext = useCallback(
    async (id: string, input: UpdateContextInput) => {
      const updated = await ipcClient.context.updateContext(id, {
        sourceType: input.sourceType,
        sourceName: input.sourceName ?? undefined,
        content: input.content,
      });

      queryClient.setQueryData<ThoughtDTO>(["thought.getThoughtById", thoughtId], (old) => {
        if (!old) return old;
        return {
          ...old,
          contexts: old.contexts.map((ctx) => (ctx.id === id ? { ...ctx, ...updated } : ctx)),
        };
      });
    },
    [thoughtId, queryClient],
  );

  const deleteContext = useCallback(
    async (id: string) => {
      await ipcClient.context.deleteContext(id);

      queryClient.setQueryData<ThoughtDTO>(["thought.getThoughtById", thoughtId], (old) => {
        if (!old) return old;
        return { ...old, contexts: old.contexts.filter((ctx) => ctx.id !== id) };
      });

      queryClient.setQueriesData<ThoughtSummaryDTO[]>(
        { queryKey: ["thought.listThoughts"], exact: false },
        patchThoughtInList(thoughtId, (item) => ({
          ...item,
          contextCount: Math.max(0, item.contextCount - 1),
        })),
      );
    },
    [thoughtId, queryClient],
  );

  return {
    updateThought,
    createContext,
    updateContext,
    deleteContext,
  };
}
