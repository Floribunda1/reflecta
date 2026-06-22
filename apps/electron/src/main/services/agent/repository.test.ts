import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { count, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  agentRuns,
  agentToolInvocations,
  createDBInstance,
  type ReflectaDb,
} from "@reflecta/server";
import type { AgentChatMessage } from "@shared/chat";
import { AgentRepository } from "./repository";

let tempDir: string;
let db: ReflectaDb;
let repository: AgentRepository;

function textMessage(id: string, role: AgentChatMessage["role"], text: string): AgentChatMessage {
  return { id, role, parts: [{ type: "text", text }] };
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "reflecta-agent-repo-"));
  db = await createDBInstance(join(tempDir, "test.db"));
  repository = new AgentRepository(() => db);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("AgentRepository", () => {
  test("lists messages in sequence and truncates after edited user message", async () => {
    const thread = await repository.createThread();
    await repository.appendMessage(thread.id, textMessage("u1", "user", "first"));
    await repository.appendMessage(thread.id, textMessage("a1", "assistant", "reply"));
    await repository.appendMessage(thread.id, textMessage("u2", "user", "second"));

    expect((await repository.getMessages(thread.id)).map((message) => message.id)).toEqual([
      "u1",
      "a1",
      "u2",
    ]);

    await repository.appendMessage(thread.id, textMessage("u1", "user", "edited"));

    const messages = await repository.getMessages(thread.id);
    expect(messages.map((message) => message.id)).toEqual(["u1"]);
    expect(messages[0]?.parts[0]).toMatchObject({ type: "text", text: "edited" });
  });

  test("keeps message creation time", async () => {
    const thread = await repository.createThread();
    await repository.appendMessage(thread.id, {
      ...textMessage("u1", "user", "first"),
      createdAt: "2026-06-21T08:07:00.000Z",
    });

    expect((await repository.getMessages(thread.id))[0]?.createdAt).toBe(
      "2026-06-21T08:07:00.000Z",
    );
  });

  test("keeps existing messages when replacement fails", async () => {
    const thread = await repository.createThread();
    const otherThread = await repository.createThread();
    await repository.appendMessage(thread.id, textMessage("u1", "user", "original"));
    await repository.appendMessage(otherThread.id, textMessage("duplicate", "user", "other"));

    await expect(
      repository.replaceMessages(thread.id, [textMessage("duplicate", "user", "new")]),
    ).rejects.toThrow();

    expect((await repository.getMessages(thread.id)).map((message) => message.id)).toEqual(["u1"]);
  });

  test("stores readable first message title for composer mentions", async () => {
    const thread = await repository.createThread();
    await repository.appendMessage(thread.id, {
      id: "u1",
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
    });

    expect((await repository.listThreads())[0]).toMatchObject({
      title: "三观 你好",
    });
  });

  test("upserts tool invocations by toolCallId", async () => {
    const thread = await repository.createThread();
    await repository.recordToolInvocation({
      threadId: thread.id,
      toolCallId: "call-1",
      toolName: "thought_create",
      state: "output_available",
      input: { body: "old" },
      output: { approvalStatus: "pending", body: "old" },
      approvalStatus: "pending",
    });
    await repository.recordToolInvocation({
      threadId: thread.id,
      toolCallId: "call-1",
      toolName: "thought_create",
      state: "output_available",
      input: { body: "new" },
      output: { approvalStatus: "pending", body: "new" },
      approvalStatus: "pending",
    });

    const rows = await db.select({ value: count() }).from(agentToolInvocations);
    const invocation = await repository.getToolInvocation("call-1");
    expect(rows[0]?.value).toBe(1);
    expect(invocation?.inputJson).toBe(JSON.stringify({ body: "new" }));
  });

  test("marks interrupted streaming runs failed", async () => {
    const thread = await repository.createThread();
    const runId = await repository.createRun(thread.id, "test-model");

    await repository.markInterruptedRuns();

    const rows = await db.select().from(agentRuns).where(eq(agentRuns.id, runId));
    expect(rows[0]?.status).toBe("failed");
    expect(rows[0]?.errorText).toBe("App restarted before stream finished");
  });
});
