import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import type { AgentChatMessage, AgentThreadDTO } from "@shared/chat";
import {
  invalidateThreadSnapshot,
  refreshThreadTitle,
  removeThreadFromCache,
  renameThreadInCache,
  replaceThreadMessages,
} from "./query-cache";
import { chatQueryKeys } from "./query-keys";

function queryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function thread(id: string, overrides: Partial<AgentThreadDTO> = {}): AgentThreadDTO {
  return {
    id,
    title: "新对话",
    status: "active",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
    ...overrides,
  };
}

function message(id: string, role: AgentChatMessage["role"], text: string): AgentChatMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  };
}

describe("chat query cache", () => {
  test("replaces only the selected thread messages", () => {
    const client = queryClient();
    const firstMessages = [message("user-1", "user", "first")];
    const secondMessages = [message("user-2", "user", "second")];
    client.setQueryData(chatQueryKeys.threadMessages("thread-b"), secondMessages);

    replaceThreadMessages(client, "thread-a", firstMessages);

    expect(client.getQueryData(chatQueryKeys.threadMessages("thread-a"))).toBe(firstMessages);
    expect(client.getQueryData(chatQueryKeys.threadMessages("thread-b"))).toBe(secondMessages);
  });

  test("refreshes one new thread title from first user message", () => {
    const client = queryClient();
    client.setQueryData(chatQueryKeys.threads, [
      thread("thread-a"),
      thread("thread-b", { title: "Keep" }),
    ]);

    refreshThreadTitle(client, "thread-a", [
      message("user-1", "user", "What is workflow feedback loop?"),
      message("assistant-1", "assistant", "It is an iteration loop."),
    ]);

    expect(client.getQueryData<AgentThreadDTO[]>(chatQueryKeys.threads)).toMatchObject([
      {
        id: "thread-a",
        title: "What is workflow feedback loop?",
      },
      { id: "thread-b", title: "Keep" },
    ]);
  });

  test("refreshes title with readable composer mention labels", () => {
    const client = queryClient();
    client.setQueryData(chatQueryKeys.threads, [thread("thread-a")]);

    refreshThreadTitle(client, "thread-a", [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "[[category:三观#category-1]] 你好" }],
        metadata: {
          contextRefs: [{ type: "category", id: "category-1", title: "三观" }],
          composerContent: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "mention", attrs: { id: "category:category-1", label: "三观" } },
                  { type: "text", text: " 你好" },
                ],
              },
            ],
          },
        },
      },
    ]);

    expect(client.getQueryData<AgentThreadDTO[]>(chatQueryKeys.threads)?.[0]).toMatchObject({
      title: "三观 你好",
    });
  });

  test("does not overwrite an existing custom title", () => {
    const client = queryClient();
    client.setQueryData(chatQueryKeys.threads, [thread("thread-a", { title: "Custom title" })]);

    refreshThreadTitle(client, "thread-a", [
      message("user-1", "user", "First message"),
      message("assistant-1", "assistant", "New answer"),
    ]);

    expect(client.getQueryData<AgentThreadDTO[]>(chatQueryKeys.threads)?.[0]).toMatchObject({
      title: "Custom title",
    });
  });

  test("invalidates thread messages and thread list", async () => {
    const client = queryClient();
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");

    await invalidateThreadSnapshot(client, "thread-a");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: chatQueryKeys.threadMessages("thread-a"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: chatQueryKeys.threads });
  });

  test("remove and rename helpers update only thread list cache", () => {
    const client = queryClient();
    client.setQueryData(chatQueryKeys.threads, [thread("thread-a"), thread("thread-b")]);

    renameThreadInCache(client, "thread-b", "Renamed");
    removeThreadFromCache(client, "thread-a");

    expect(client.getQueryData<AgentThreadDTO[]>(chatQueryKeys.threads)).toMatchObject([
      { id: "thread-b", title: "Renamed" },
    ]);
  });
});
