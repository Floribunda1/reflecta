import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { runPromise } from "@renderer/lib/effect-runtime";
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
  return useQuery({
    queryKey: chatQueryKeys.threads,
    queryFn: () => runPromise(rpc.chatListThreads()) as Promise<AgentSessionSummary[]>,
  });
}

export function useAgentModelOptionsQuery() {
  return useQuery({
    queryKey: chatQueryKeys.modelOptions,
    queryFn: async (): Promise<AiModelsQueryData> => {
      const [options, active, activeReasoningLevel] = await Promise.all([
        runPromise(rpc.configListModelOptions()) as Promise<AiModelOption[]>,
        runPromise(rpc.configGetActiveModel()),
        runPromise(rpc.configGetReasoningLevel()),
      ]);
      return { options, active, activeReasoningLevel };
    },
  });
}

export function useCreateThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => runPromise(rpc.chatCreateThread(title)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useForkThreadFromMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, messageId }: { threadId: string; messageId: string }) =>
      runPromise(rpc.chatForkFromMessage(threadId, messageId)),
    onSuccess: async (thread) => {
      upsertThreadInCache(queryClient, thread);
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useDeleteThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => runPromise(rpc.chatDeleteThread(threadId)),
    onSuccess: async (_result, threadId) => {
      removeThreadFromCache(queryClient, threadId);
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useArchiveThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => runPromise(rpc.chatArchiveThread(threadId)),
    onSuccess: async (_result, threadId) => {
      removeThreadFromCache(queryClient, threadId);
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useRenameThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) =>
      runPromise(rpc.chatRenameThread(threadId, title)),
    onSuccess: async (_result, { threadId, title }) => {
      renameThreadInCache(queryClient, threadId, title);
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useGenerateThreadTitleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => runPromise(rpc.chatGenerateTitle(threadId)),
    onSuccess: async (title, threadId) => {
      renameThreadInCache(queryClient, threadId, title);
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useSelectAgentModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (selection: AgentModelSelection) =>
      runPromise(
        rpc.configSetActiveModel(selection as import("../../../../../ipc").AiModelSelection),
      ),
    onSuccess: (activeReasoningLevel, selection) => {
      queryClient.setQueryData<AiModelsQueryData>(chatQueryKeys.modelOptions, (current) =>
        current ? { ...current, active: selection, activeReasoningLevel } : current,
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.modelOptions });
    },
  });
}

export function useSelectAgentReasoningLevelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (level: AgentReasoningLevel) =>
      runPromise(
        rpc.configSetReasoningLevel(level as import("../../../../../ipc").AiReasoningLevel),
      ),
    onMutate: (level) => {
      queryClient.setQueryData<AiModelsQueryData>(chatQueryKeys.modelOptions, (current) =>
        current ? { ...current, activeReasoningLevel: level } : current,
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.modelOptions });
    },
  });
}
