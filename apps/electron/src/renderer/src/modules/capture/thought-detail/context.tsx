import { ipcClient } from "@renderer/utils/ipc";
import type { ContextDTO, CreateContextInput, UpdateContextInput } from "@shared/context";
import type { ThoughtDTO, ThoughtSummaryDTO, ThoughtType } from "@shared/thought";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { cloneDeep, debounce } from "lodash-es";
import { createContext, ReactNode, useContext, useMemo } from "react";

type ThoughtDetailContextValue = {
  thought: ThoughtDTO | null;
  loading: boolean;
  updateThought: (input: {
    type?: ThoughtType;
    title?: string | null;
    body?: string;
    categoryIds?: string[];
  }) => Promise<void>;
  createContext: (input: Omit<CreateContextInput, "thoughtId">) => Promise<ContextDTO>;
  updateContext: (id: string, input: UpdateContextInput) => Promise<void>;
  deleteContext: (id: string) => Promise<void>;
};

const ThoughtDetailContext = createContext<ThoughtDetailContextValue | null>(null);

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

export function ThoughtDetailProvider({
  thoughtId,
  children,
}: {
  thoughtId: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const {
    data: thought,
    isFetching: loading,
  } = useQuery({
    queryKey: ["thought.getThoughtById", thoughtId],
    queryFn: () => ipcClient.thought.getThoughtById(thoughtId),
  });

  const updateThought: ThoughtDetailContextValue["updateThought"] = async (input) => {
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
        connectionIds: result.connections.map((c) => c.id),
        updatedAt: result.updatedAt,
      })),
    );

    if (input.body !== undefined) {
      invalidateRelatedThoughtDetails(queryClient);
    }
  };

  const createContext: ThoughtDetailContextValue["createContext"] = async (input) => {
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
  };

  const updateContext: ThoughtDetailContextValue["updateContext"] = async (id, input) => {
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
  };

  const deleteContext = async (id: string) => {
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
  };

  const value = useMemo(
    () => ({
      thought: thought ?? null,
      loading,
      updateThought,
      createContext,
      updateContext,
      deleteContext,
    }),
    [thought, loading],
  );

  return <ThoughtDetailContext.Provider value={value}>{children}</ThoughtDetailContext.Provider>;
}

export function useThoughtDetailContext() {
  const context = useContext(ThoughtDetailContext);
  if (!context)
    throw new Error("useThoughtDetailContext must be used within ThoughtDetailProvider");
  return context;
}
