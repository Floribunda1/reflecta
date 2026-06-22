import { describe, expect, test, vi } from "vitest";
import { convertToModelMessages } from "ai";
import type { AgentChatMessage } from "@shared/chat";
import {
  cleanGeneratedThreadTitle,
  finalMessagesForFinish,
  modelMessagesForProvider,
  normalizeDeniedToolApprovals,
  prepareMessagesForRun,
  providerOptionsForReasoning,
  selectModelMessages,
} from "./runtime";

vi.mock("../core", () => ({
  categoryCliService: {},
  contextService: {},
  contextCliService: {},
  graphService: {},
  searchCliService: {},
  snapshotService: {},
  thoughtService: {},
  thoughtCliService: {},
}));

function message(index: number): AgentChatMessage {
  return {
    id: `m${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    parts: [{ type: "text", text: String(index) }],
  };
}

describe("selectModelMessages", () => {
  test("keeps recent history when pruning long chats", () => {
    const messages = Array.from({ length: 30 }, (_, index) => message(index));
    const selected = selectModelMessages(messages);
    expect(selected).toHaveLength(24);
    expect(selected[0]?.id).toBe("m6");
    expect(selected.at(-1)?.id).toBe("m29");
  });
});

describe("cleanGeneratedThreadTitle", () => {
  test("strips quotes, whitespace, and clamps long output", () => {
    expect(cleanGeneratedThreadTitle("  “对话标题”\n")).toBe("对话标题");
    expect(cleanGeneratedThreadTitle("")).toBe("新对话");
    expect(cleanGeneratedThreadTitle("一".repeat(60))).toHaveLength(40);
  });
});

describe("modelMessagesForProvider", () => {
  test("keeps native file parts for OpenAI", () => {
    const messages: AgentChatMessage[] = [
      {
        id: "u1",
        role: "user",
        parts: [
          { type: "text", text: "看这张图" },
          {
            type: "file",
            mediaType: "image/png",
            filename: "screen.png",
            url: "data:image/png;base64,AA==",
          },
        ],
      },
    ];

    expect(
      modelMessagesForProvider(messages, "openai")[0]?.parts.some((part) => part.type === "file"),
    ).toBe(true);
  });

  test("downgrades file parts for OpenAI-compatible providers", () => {
    const messages: AgentChatMessage[] = [
      {
        id: "u1",
        role: "user",
        parts: [
          { type: "text", text: "读附件" },
          {
            type: "file",
            mediaType: "text/plain",
            filename: "note.txt",
            url: `data:text/plain;base64,${Buffer.from("hello file").toString("base64")}`,
            providerMetadata: { reflecta: { attachmentId: "att-note", size: 10 } },
          },
          {
            type: "file",
            mediaType: "image/png",
            filename: "screen.png",
            url: "data:image/png;base64,AA==",
          },
        ],
      },
    ];

    const parts = modelMessagesForProvider(messages, "deepseek")[0]?.parts ?? [];
    const text = parts.map((part) => ("text" in part ? part.text : "")).join("\n");
    expect(parts.some((part) => part.type === "file")).toBe(false);
    expect(text).toContain("attachmentId=att-note");
    expect(text).toContain("attachment_read");
    expect(text).toContain("screen.png");
    expect(text).not.toContain("hello file");
  });
});

describe("finalMessagesForFinish", () => {
  test("uses the finished stream messages so approval continuations do not duplicate ids", () => {
    const original = [
      message(0),
      { ...message(1), id: "assistant-approval" },
    ] satisfies AgentChatMessage[];
    const continued = {
      ...original[1]!,
      parts: [{ type: "text", text: "approval responded" }],
    } satisfies AgentChatMessage;

    const result = finalMessagesForFinish({
      inputMessages: original,
      finishMessages: [original[0]!, continued],
      responseMessage: continued,
    });

    expect(result.map((item) => item.id)).toEqual(["m0", "assistant-approval"]);
    expect(result[1]?.parts).toEqual([{ type: "text", text: "approval responded" }]);
  });
});

describe("normalizeDeniedToolApprovals", () => {
  test("turns denied approvals into denied tool outputs before provider conversion", () => {
    const messages: AgentChatMessage[] = [
      {
        id: "assistant-approval",
        role: "assistant",
        parts: [
          {
            type: "tool-thought_create",
            toolCallId: "call-1",
            state: "approval-responded",
            input: { title: "过程性指标" },
            approval: { id: "approval-1", approved: false },
          } as AgentChatMessage["parts"][number],
        ],
      },
    ];

    const result = normalizeDeniedToolApprovals(messages);

    expect(result[0]?.parts[0]).toMatchObject({
      type: "tool-thought_create",
      toolCallId: "call-1",
      state: "output-denied",
      approval: { id: "approval-1", approved: false },
    });
    expect(messages[0]?.parts[0]).toMatchObject({ state: "approval-responded" });
  });

  test("makes denied approvals convert to tool results for OpenAI-compatible providers", async () => {
    const messages = normalizeDeniedToolApprovals([
      {
        id: "assistant-approval",
        role: "assistant",
        parts: [
          {
            type: "tool-thought_create",
            toolCallId: "call-1",
            state: "approval-responded",
            input: { title: "过程性指标" },
            approval: { id: "approval-1", approved: false },
          } as AgentChatMessage["parts"][number],
        ],
      },
    ]);

    const modelMessages = await convertToModelMessages(messages);

    expect(JSON.stringify(modelMessages)).toContain("tool-result");
    expect(JSON.stringify(modelMessages)).toContain("call-1");
  });
});

describe("prepareMessagesForRun", () => {
  test("drops empty assistant messages left behind by failed streams", () => {
    const result = prepareMessagesForRun([
      message(0),
      { id: "empty-assistant", role: "assistant", parts: [] },
    ]);

    expect(result.map((item) => item.id)).toEqual(["m0"]);
  });
});

describe("providerOptionsForReasoning", () => {
  test("requests OpenAI reasoning summaries with default effort", () => {
    expect(providerOptionsForReasoning("default")).toEqual({
      openai: { reasoningSummary: "auto" },
    });
  });

  test("requests OpenAI reasoning summaries for visible thinking", () => {
    expect(providerOptionsForReasoning("high")).toEqual({
      openai: { reasoningEffort: "high", reasoningSummary: "auto" },
    });
  });

  test("keeps Codex subscription responses stateless", () => {
    expect(
      providerOptionsForReasoning("high", "openai", {
        instructions: "system prompt",
        storeResponses: false,
      }),
    ).toEqual({
      openai: {
        include: ["reasoning.encrypted_content"],
        instructions: "system prompt",
        reasoningEffort: "high",
        reasoningSummary: "auto",
        store: false,
      },
    });
  });

  test("requests compatible provider reasoning effort without OpenAI summary options", () => {
    expect(providerOptionsForReasoning("high", "opencodeZen")).toEqual({
      openaiCompatible: { reasoningEffort: "high" },
      opencodeZen: { reasoningEffort: "high" },
    });
  });
});
