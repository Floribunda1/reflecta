import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { AiModelOption } from "@main/config";
import type { AgentModelSelection, AgentReasoningLevel } from "@shared/agent";
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
    queryFn: () => ipcClient.chat.listThreads(),
  });
}

export function useAgentModelOptionsQuery() {
  return useQuery({
    queryKey: chatQueryKeys.modelOptions,
    queryFn: async (): Promise<AiModelsQueryData> => {
      const [options, active, activeReasoningLevel] = await Promise.all([
        ipcClient.config.listAiModelOptions(),
        ipcClient.config.getActiveAgentModel(),
        ipcClient.config.getActiveAgentReasoningLevel(),
      ]);
      return { options, active, activeReasoningLevel };
    },
  });
}

export function useCreateThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => ipcClient.chat.createThread(title),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useForkThreadFromMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, messageId }: { threadId: string; messageId: string }) =>
      ipcClient.chat.forkThreadFromMessage(threadId, messageId),
    onSuccess: async (thread) => {
      upsertThreadInCache(queryClient, thread);
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useDeleteThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => ipcClient.chat.deleteThread(threadId),
    onSuccess: async (_result, threadId) => {
      removeThreadFromCache(queryClient, threadId);
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useArchiveThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => ipcClient.chat.archiveThread(threadId),
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
      ipcClient.chat.renameThread(threadId, title),
    onSuccess: async (_result, { threadId, title }) => {
      renameThreadInCache(queryClient, threadId, title);
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useGenerateThreadTitleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => ipcClient.chat.generateThreadTitle(threadId),
    onSuccess: async (title, threadId) => {
      renameThreadInCache(queryClient, threadId, title);
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
    },
  });
}

export function useSelectAgentModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (selection: AgentModelSelection) => ipcClient.config.setActiveAgentModel(selection),
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
      ipcClient.config.setActiveAgentReasoningLevel(level),
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
