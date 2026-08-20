import { Effect } from "effect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { effectQuery } from "@renderer/lib/effect-query";
import { rpc } from "@renderer/lib/effect-rpc";
import type { AiModelOption } from "@main/config";
import type { AgentModelSelection, AgentReasoningLevel, AgentSessionSummary } from "@shared/agent";
import { removeThreadFromCache, renameThreadInCache, upsertThreadInCache } from "./query-cache";
import { chatQueryKeys } from "./query-keys";

export type { AiModelOption } from "@main/config";

export type AiModelsQueryData = {
  options: AiModelOption[];
  active: AgentModelSelection | null;
  activeReasoningLevel: AgentReasoningLevel;
};

export function useThreadsQuery() {
  return useQuery(
    effectQuery.queryOptions({
      queryKey: chatQueryKeys.threads,
      queryFn: () =>
        rpc.chatListThreads().pipe(Effect.map((rows) => rows as AgentSessionSummary[])),
    }),
  );
}

export function useAgentModelOptionsQuery() {
  return useQuery(
    effectQuery.queryOptions({
      queryKey: chatQueryKeys.modelOptions,
      queryFn: () =>
        Effect.all([
          rpc.configListModelOptions(),
          rpc.configGetActiveModel(),
          rpc.configGetReasoningLevel(),
        ]).pipe(
          Effect.map(([options, active, activeReasoningLevel]) => ({
            options: options as AiModelOption[],
            active: active as AgentModelSelection | null,
            activeReasoningLevel: activeReasoningLevel as AgentReasoningLevel,
          })),
        ),
    }),
  );
}

export function useCreateThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (title?: string) => rpc.chatCreateThread(title),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
      },
    }),
  );
}

export function useForkThreadFromMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: ({ threadId, messageId }: { threadId: string; messageId: string }) =>
        rpc
          .chatForkFromMessage(threadId, messageId)
          .pipe(Effect.map((thread) => thread as AgentSessionSummary)),
      onSuccess: async (thread) => {
        upsertThreadInCache(queryClient, thread);
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
      },
    }),
  );
}

export function useDeleteThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (threadId: string) => rpc.chatDeleteThread(threadId),
      onSuccess: async (_result, threadId) => {
        removeThreadFromCache(queryClient, threadId);
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
      },
    }),
  );
}

export function useArchiveThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (threadId: string) => rpc.chatArchiveThread(threadId),
      onSuccess: async (_result, threadId) => {
        removeThreadFromCache(queryClient, threadId);
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
      },
    }),
  );
}

export function useRenameThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: ({ threadId, title }: { threadId: string; title: string }) =>
        rpc.chatRenameThread(threadId, title),
      onSuccess: async (_result, { threadId, title }) => {
        renameThreadInCache(queryClient, threadId, title);
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
      },
    }),
  );
}

export function useGenerateThreadTitleMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (threadId: string) => rpc.chatGenerateTitle(threadId),
      onSuccess: async (title, threadId) => {
        renameThreadInCache(queryClient, threadId, title);
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
      },
    }),
  );
}

export function useSelectAgentModelMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (selection: AgentModelSelection) =>
        rpc.configSetActiveModel(selection as import("../../../../../ipc").AiModelSelection),
      onSuccess: (activeReasoningLevel, selection) => {
        queryClient.setQueryData<AiModelsQueryData>(chatQueryKeys.modelOptions, (current) =>
          current ? { ...current, active: selection, activeReasoningLevel } : current,
        );
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.modelOptions });
      },
    }),
  );
}

export function useSelectAgentReasoningLevelMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    effectQuery.mutationOptions({
      mutationFn: (level: AgentReasoningLevel) =>
        rpc.configSetReasoningLevel(level as import("../../../../../ipc").AiReasoningLevel),
      onMutate: (level) => {
        queryClient.setQueryData<AiModelsQueryData>(chatQueryKeys.modelOptions, (current) =>
          current ? { ...current, activeReasoningLevel: level } : current,
        );
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.modelOptions });
      },
    }),
  );
}
