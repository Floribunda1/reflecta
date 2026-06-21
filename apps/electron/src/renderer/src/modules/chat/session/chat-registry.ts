import { Chat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import type { QueryClient } from "@tanstack/react-query";
import type { AgentChatMessage } from "@shared/chat";
import { ElectronChatTransport } from "./electron-chat-transport";
import { chatUiStore } from "./chat-ui-store";
import { invalidateThreadSnapshot, refreshThreadTitle, replaceThreadMessages } from "./query-cache";

const chats = new Map<string, Chat<AgentChatMessage>>();

export function getAgentThreadChat({
  threadId,
  messages,
  queryClient,
}: {
  threadId: string;
  messages: AgentChatMessage[];
  queryClient: QueryClient;
}) {
  const existing = chats.get(threadId);
  if (existing) return existing;

  const chat = new Chat<AgentChatMessage>({
    id: threadId,
    messages,
    transport: new ElectronChatTransport(threadId),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: ({ messages: finalMessages, isAbort, isError }) => {
      chatUiStore.getState().setThreadRunning(threadId, false);
      if (isAbort || isError) return;
      replaceThreadMessages(queryClient, threadId, finalMessages);
      refreshThreadTitle(queryClient, threadId, finalMessages);
      void invalidateThreadSnapshot(queryClient, threadId);
    },
    onError: () => {
      chatUiStore.getState().setThreadRunning(threadId, false);
    },
  });

  chats.set(threadId, chat);
  return chat;
}

export function removeAgentThreadChat(threadId: string, { stop = false } = {}) {
  const chat = chats.get(threadId);
  if (!chat) return;
  if (stop && (chat.status === "submitted" || chat.status === "streaming")) {
    void chat.stop();
  }
  chats.delete(threadId);
}
