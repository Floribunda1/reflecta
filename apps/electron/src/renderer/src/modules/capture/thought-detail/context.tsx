import { ipcClient } from "@renderer/utils/ipc";
import type { CreateContextInput, UpdateContextInput } from "@shared/context";
import type { ThoughtDTO, ThoughtSummaryDTO, ThoughtType } from "@shared/thought";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { createInjectionState } from "@vueuse/core";
import { cloneDeep } from "lodash-es";
import { computed, Ref } from "vue";

const [createThoughtDetailContext, useThoughtDetailContext] = createInjectionState(
  (thoughtId: Ref<string>) => {
    const queryClient = useQueryClient();

    const {
      data: thought,
      isFetching: loading,
      refetch,
    } = useQuery({
      queryKey: ["thought.getThoughtById", thoughtId],
      queryFn: () => ipcClient.thought.getThoughtById(thoughtId.value!),
    });

    const updateThought = async (input: {
      type?: ThoughtType;
      title?: string | null;
      body?: string;
      categoryIds?: string[];
    }) => {
      const result = await ipcClient.thought.updateThought(thoughtId.value, cloneDeep(input));

      queryClient.setQueryData<ThoughtDTO>(["thought.getThoughtById", thoughtId.value], (old) => {
        if (!old) return old;
        return {
          ...old,
          type: input.type ?? result.type,
          title: input.title !== undefined ? input.title : old.title,
          body: input.body ?? old.body,
          categoryIds: input.categoryIds ?? old.categoryIds,
          connections: result.connections,
          referencedBy: result.referencedBy,
          contexts: result.contexts,
          updatedAt: result.updatedAt,
        };
      });

      const patchList = (old: ThoughtSummaryDTO[] | undefined) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === thoughtId.value
            ? {
                ...item,
                type: input.type ?? result.type,
                title: input.title !== undefined ? input.title : item.title,
                body: input.body ?? item.body,
                categoryIds: input.categoryIds ?? item.categoryIds,
                updatedAt: result.updatedAt,
              }
            : item,
        );
      };

      queryClient.setQueriesData<ThoughtSummaryDTO[]>(
        { queryKey: ["thought.listThoughts"], exact: false },
        patchList,
      );

      queryClient.setQueriesData<ThoughtSummaryDTO[]>(
        { queryKey: ["contemplate.listThoughts"], exact: false },
        patchList,
      );

      if (input.body !== undefined) {
        queryClient.invalidateQueries({ queryKey: ["thought.listThoughts"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["contemplate.listThoughts"], exact: false });
      }
    };

    const createContext = async (input: Omit<CreateContextInput, "thoughtId.value">) => {
      await ipcClient.context.createContext({
        thoughtId: thoughtId.value!,
        sourceType: input.sourceType,
        sourceName: input.sourceName,
        content: input.content,
      });
      queryClient.invalidateQueries({
        queryKey: ["thought.getThoughtById", thoughtId.value],
      });
      await refetch();
    };

    const updateContext = async (id: string, input: UpdateContextInput) => {
      await ipcClient.context.updateContext(id, {
        sourceType: input.sourceType,
        sourceName: input.sourceName ?? undefined,
        content: input.content,
      });
      queryClient.invalidateQueries({
        queryKey: ["thought.getThoughtById", thoughtId.value],
      });
      await refetch();
    };

    const deleteContext = async (id: string) => {
      await ipcClient.context.deleteContext(id);
      await refetch();
      queryClient.invalidateQueries({
        queryKey: ["thought.getThoughtById", thoughtId.value],
      });
    };

    return {
      thought: computed(() => thought.value ?? null),
      loading,
      updateThought,
      createContext,
      updateContext,
      deleteContext,
    };
  },
);

export { createThoughtDetailContext, useThoughtDetailContext };
