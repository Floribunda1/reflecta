import type { QueryClient } from "@tanstack/react-query";
import type { AgentSessionSummary } from "@shared/agent";
import { chatQueryKeys } from "./query-keys";

export function removeThreadFromCache(queryClient: QueryClient, threadId: string) {
  queryClient.setQueryData<AgentSessionSummary[]>(chatQueryKeys.threads, (threads) =>
    threads?.filter((thread) => thread.id !== threadId),
  );
  queryClient.removeQueries({ queryKey: chatQueryKeys.sessionEvents(threadId) });
}

export function renameThreadInCache(queryClient: QueryClient, threadId: string, title: string) {
  queryClient.setQueryData<AgentSessionSummary[]>(chatQueryKeys.threads, (threads) =>
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

export function upsertThreadInCache(queryClient: QueryClient, thread: AgentSessionSummary) {
  queryClient.setQueryData<AgentSessionSummary[]>(chatQueryKeys.threads, (threads) => {
    const current = threads ?? [];
    return current.some((item) => item.id === thread.id) ? current : [thread, ...current];
  });
}
