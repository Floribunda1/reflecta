import type { QueryClient } from "@tanstack/react-query";
import type { AgentChatMessage, AgentThreadDTO } from "@shared/chat";
import { agentMessageDisplayText } from "@shared/chat-display";
import { chatQueryKeys } from "./query-keys";

function firstUserTitle(messages: AgentChatMessage[]) {
  const message = messages.find((item) => item.role === "user");
  return message ? agentMessageDisplayText(message).slice(0, 40) : "";
}

function shouldRefreshTitle(thread: AgentThreadDTO, messages: AgentChatMessage[]) {
  const firstMessage = messages[0];
  if (!firstMessage || firstMessage.role !== "user") return false;
  return thread.title === "新对话";
}

export function replaceThreadMessages(
  queryClient: QueryClient,
  threadId: string,
  messages: AgentChatMessage[],
) {
  queryClient.setQueryData(chatQueryKeys.threadMessages(threadId), messages);
}

export function refreshThreadTitle(
  queryClient: QueryClient,
  threadId: string,
  messages: AgentChatMessage[],
) {
  const now = new Date().toISOString();
  queryClient.setQueryData<AgentThreadDTO[]>(chatQueryKeys.threads, (threads) =>
    threads?.map((thread) => {
      if (thread.id !== threadId) return thread;
      const title = shouldRefreshTitle(thread, messages) ? firstUserTitle(messages) : thread.title;
      return {
        ...thread,
        title: title || thread.title,
        updatedAt: now,
      };
    }),
  );
}

export async function invalidateThreadSnapshot(queryClient: QueryClient, threadId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chatQueryKeys.threadMessages(threadId) }),
    queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads }),
  ]);
}

export function removeThreadFromCache(queryClient: QueryClient, threadId: string) {
  queryClient.setQueryData<AgentThreadDTO[]>(chatQueryKeys.threads, (threads) =>
    threads?.filter((thread) => thread.id !== threadId),
  );
  queryClient.removeQueries({ queryKey: chatQueryKeys.threadMessages(threadId) });
}

export function renameThreadInCache(queryClient: QueryClient, threadId: string, title: string) {
  queryClient.setQueryData<AgentThreadDTO[]>(chatQueryKeys.threads, (threads) =>
    threads?.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            title,
            updatedAt: new Date().toISOString(),
          }
        : thread,
    ),
  );
}

export function upsertThreadInCache(queryClient: QueryClient, thread: AgentThreadDTO) {
  queryClient.setQueryData<AgentThreadDTO[]>(chatQueryKeys.threads, (threads) => {
    const current = threads ?? [];
    return current.some((item) => item.id === thread.id) ? current : [thread, ...current];
  });
}
