import { describe, expect, test, vi } from "vitest";
import type { Api, Model } from "@earendil-works/pi-ai";
import { runAgentFinalizer, withFinalAnswerStructuredOutput } from "./agent-finalizer";

async function* chunks(values: string[]) {
  for (const value of values) yield value;
}

const catalog = [
  {
    key: "domain:domain_1",
    entity: { type: "domain" as const, id: "domain_1", title: "三观" },
    origin: { kind: "tool_result" as const, toolCallId: "tool_1", toolName: "domain_inspect" },
  },
];

const opencodeGoModel = {
  api: "openai-completions",
  provider: "opencode-go",
} as Model<Api>;

describe("runAgentFinalizer", () => {
  test("returns Pi draft text directly when no entity refs are needed", async () => {
    const onPartial = vi.fn();
    const streamJson = vi.fn();
    const result = await runAgentFinalizer(
      {
        userQuestion: "hello",
        piDraftText: "plain markdown **reply**",
        toolResults: [],
        entityCatalog: [],
        requiresEntityRefs: false,
        onPartial,
      },
      { streamJson },
    );

    expect(result).toEqual({
      text: "plain markdown **reply**",
      parts: [{ type: "text", text: "plain markdown **reply**" }],
    });
    expect(onPartial).toHaveBeenCalledWith(result);
    expect(streamJson).not.toHaveBeenCalled();
  });

  test("streams stable parts and preview text before returning the final answer", async () => {
    const onPartial = vi.fn();
    const result = await runAgentFinalizer(
      {
        userQuestion: "这个理解放在哪里",
        piDraftText: "放在三观下面。",
        toolResults: [],
        entityCatalog: catalog,
        requiresEntityRefs: true,
        onPartial,
      },
      {
        streamJson: () =>
          chunks([
            '{"parts":[{"type":"text","text":"放在"},',
            '{"type":"entity_ref","entityType":"domain","entityId":"domain_1","fallbackText":"三观"},',
            '{"type":"text","text":"下面。"}]}',
          ]),
      },
    );

    expect(result).toEqual({
      text: "放在三观下面。",
      parts: [
        { type: "text", text: "放在" },
        {
          type: "entity_ref",
          entityType: "domain",
          entityId: "domain_1",
          fallbackText: "三观",
        },
        { type: "text", text: "下面。" },
      ],
    });
    expect(onPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("放在"),
        parts: expect.arrayContaining([{ type: "text", text: "放在" }]),
      }),
    );
  });

  test("retries once and fails when final answer references a missing entity", async () => {
    const onPartial = vi.fn();
    await expect(
      runAgentFinalizer(
        {
          userQuestion: "这个理解放在哪里",
          piDraftText: "放在三观下面。",
          toolResults: [],
          entityCatalog: catalog,
          requiresEntityRefs: true,
          onPartial,
        },
        {
          maxAttempts: 2,
          streamJson: () =>
            chunks([
              '{"parts":[{"type":"entity_ref","entityType":"domain","entityId":"missing","fallbackText":"三观"}]}',
            ]),
        },
      ),
    ).rejects.toThrow("引用实体不存在: domain/missing");
  });

  test("fails when entity refs are required but the final answer has none", async () => {
    await expect(
      runAgentFinalizer(
        {
          userQuestion: "根据知识库回答",
          piDraftText: "三观相关。",
          toolResults: [],
          entityCatalog: catalog,
          requiresEntityRefs: true,
          onPartial: vi.fn(),
        },
        {
          streamJson: () => chunks(['{"parts":[{"type":"text","text":"三观相关。"}]}']),
        },
      ),
    ).rejects.toThrow("缺少必要实体引用");
  });

  test("patches OpenAI Responses payload with structured text format", () => {
    expect(
      withFinalAnswerStructuredOutput({
        model: "gpt-4o",
        input: [],
        stream: true,
        store: false,
      }),
    ).toMatchObject({
      text: {
        format: {
          type: "json_schema",
          name: "reflecta_final_answer",
          strict: true,
          schema: expect.objectContaining({ required: ["parts"] }),
        },
      },
    });
  });

  test("patches OpenAI Chat Completions payload with response_format", () => {
    expect(
      withFinalAnswerStructuredOutput({
        model: "gpt-4o",
        messages: [],
        stream: true,
      }),
    ).toMatchObject({
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reflecta_final_answer",
          strict: true,
          schema: expect.objectContaining({ required: ["parts"] }),
        },
      },
    });
  });

  test("keeps non-native structured output providers unchanged when model is known", () => {
    expect(
      withFinalAnswerStructuredOutput(
        {
          model: "deepseek-v4-flash",
          messages: [],
          stream: true,
        },
        opencodeGoModel,
      ),
    ).toEqual({
      model: "deepseek-v4-flash",
      messages: [],
      stream: true,
    });
  });
});
