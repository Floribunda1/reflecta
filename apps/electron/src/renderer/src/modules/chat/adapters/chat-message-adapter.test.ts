// @vitest-environment happy-dom
import { describe, expect, test } from "vitest";
import type { AgentReducedAssistantBlock, AgentReducedMessage } from "@shared/agent";
import { toChatMessageView } from "./chat-message-adapter";

type ApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;

const presentation = {
  entityLabels: new Map([
    ["understanding:u-1", "Understanding A"],
    ["context:c-1", "Context A"],
  ]),
  domainPath: (id: string) => `Root / ${id}`,
};

function assistant(block: AgentReducedAssistantBlock): AgentReducedMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    text: "",
    blocks: [block],
    createdAt: "2026-07-28T00:00:00.000Z",
  };
}

function approval(
  toolName: string,
  payload: Record<string, unknown>,
  overrides: Partial<ApprovalBlock> = {},
): ApprovalBlock {
  return {
    kind: "approval",
    approvalId: "approval-1",
    toolCallId: "tool-1",
    toolName,
    title: toolName,
    payload,
    state: "pending",
    approvalState: "pending",
    executionState: "not_started",
    displayState: "pending_approval",
    createdAt: "2026-07-28T00:00:00.000Z",
    ...overrides,
  };
}

function view(block: AgentReducedAssistantBlock) {
  return toChatMessageView(assistant(block), {
    assistantRunning: false,
    stopped: false,
    presentation,
  });
}

describe("chat message adapter", () => {
  test.each([
    [
      "understanding_create",
      { title: "A", body: "Body", domainIds: ["d-1"] },
      "understanding-create",
    ],
    [
      "understanding_update",
      { understandingId: "u-1", after: { body: "Next" } },
      "understanding-update",
    ],
    ["understanding_delete", { understandingId: "u-1" }, "understanding-delete"],
    ["domain_create", { name: "D", parentId: "d-1" }, "domain-create"],
    ["domain_update", { domainId: "d-1", name: "Next" }, "domain-update"],
    ["domain_delete", { domainId: "d-1", deleteUnderstandings: true }, "domain-delete"],
    [
      "context_create",
      { understandingId: "u-1", medium: "ai", title: "C", content: "Body" },
      "context-create",
    ],
    ["context_update", { contextId: "c-1", content: "Next" }, "context-update"],
    ["context_delete", { contextId: "c-1" }, "context-delete"],
    ["bash", { command: "bun test", timeoutMs: 30000 }, "bash"],
    ["future_tool", { content: "safe fallback" }, "unknown"],
  ])("maps %s to an explicit proposal view", (toolName, payload, expectedKind) => {
    const message = view(approval(toolName, payload));
    expect(message.kind).toBe("assistant");
    if (message.kind !== "assistant") return;
    expect(message.blocks[0]).toMatchObject({
      kind: "proposal",
      proposal: {
        id: "approval-1",
        kind: expectedKind,
        lifecycle: "pending",
        decisionEnabled: true,
      },
    });
  });

  test("keeps proposal identity across preview, pending, running, and completed snapshots", () => {
    const frames = [
      approval("understanding_create", { title: "A" }, { preview: true }),
      approval("understanding_create", { title: "A", body: "Body" }),
      approval(
        "understanding_create",
        { title: "A", body: "Body" },
        {
          state: "approved",
          approvalState: "approved",
          executionState: "running",
          displayState: "running",
        },
      ),
      approval(
        "understanding_create",
        { title: "A", body: "Body" },
        {
          state: "completed",
          approvalState: "approved",
          executionState: "completed",
          displayState: "completed",
        },
      ),
    ].map((block) => view(block));

    expect(
      frames.map((message) =>
        message.kind === "assistant" && message.blocks[0]?.kind === "proposal"
          ? [message.blocks[0].proposal.id, message.blocks[0].proposal.lifecycle]
          : null,
      ),
    ).toEqual([
      ["approval-1", "preview"],
      ["approval-1", "pending"],
      ["approval-1", "running"],
      ["approval-1", "completed"],
    ]);
  });

  test("keeps tool and text ids stable when complete snapshots replace streaming snapshots", () => {
    const runningTool = view({
      kind: "tool",
      toolCallId: "tool-read",
      toolName: "read",
      input: { path: "stream.ts" },
      state: "running",
      createdAt: "2026-07-28T00:00:00.000Z",
    });
    const doneTool = view({
      kind: "tool",
      toolCallId: "tool-read",
      toolName: "read",
      input: { path: "stream.ts" },
      output: { content: "done" },
      state: "completed",
      createdAt: "2026-07-28T00:00:01.000Z",
    });
    const streamingText = view({
      kind: "text",
      text: "partial",
      state: "streaming",
      createdAt: "2026-07-28T00:00:00.000Z",
    });
    const doneText = view({
      kind: "text",
      text: "complete",
      state: "done",
      createdAt: "2026-07-28T00:00:01.000Z",
    });

    expect(runningTool.kind === "assistant" ? runningTool.blocks[0] : undefined).toMatchObject({
      kind: "tool-activity",
      activity: { id: "tool-read" },
    });
    expect(doneTool.kind === "assistant" ? doneTool.blocks[0] : undefined).toMatchObject({
      kind: "tool-activity",
      activity: { id: "tool-read" },
    });
    expect(streamingText.kind === "assistant" ? streamingText.blocks[0] : undefined).toMatchObject({
      kind: "text",
      id: "assistant-1:text:0",
    });
    expect(doneText.kind === "assistant" ? doneText.blocks[0] : undefined).toMatchObject({
      kind: "text",
      id: "assistant-1:text:0",
    });
  });
});
