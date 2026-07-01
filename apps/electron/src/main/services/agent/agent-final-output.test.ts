import { describe, expect, test } from "vitest";
import {
  createReflectaFinalAnswerTool,
  finalStructuredOutputPartialFromJson,
  finalStructuredOutputPartialFromValue,
  REFLECTA_FINAL_ANSWER_TOOL_NAME,
  validateFinalStructuredOutput,
  validateFinalStructuredOutputJson,
} from "./agent-final-output";

const catalog = [
  {
    key: "domain:domain_1",
    entity: { type: "domain" as const, id: "domain_1", title: "三观" },
    origin: { kind: "tool_result" as const, toolCallId: "tool_1", toolName: "domain_inspect" },
  },
];

describe("agent final structured output", () => {
  test("creates the reflecta final answer tool", async () => {
    const tool = createReflectaFinalAnswerTool();

    expect(tool.name).toBe(REFLECTA_FINAL_ANSWER_TOOL_NAME);
    await expect(
      tool.execute(
        "tool_1",
        { parts: [{ type: "text", text: "ok" }] },
        undefined,
        undefined,
        {} as never,
      ),
    ).resolves.toMatchObject({
      details: { accepted: true },
    });
  });

  test("streams stable entity refs and keeps the trailing text as preview", () => {
    const result = finalStructuredOutputPartialFromJson(
      [
        '{"parts":[{"type":"text","text":"放在"},',
        '{"type":"entity_ref","entityType":"domain","entityId":"domain_1","fallbackText":"三观"},',
        '{"type":"text","text":"下面',
      ].join(""),
      catalog,
    );

    expect(result).toEqual({
      ok: true,
      partial: {
        text: "放在三观下面",
        parts: [
          { type: "text", text: "放在" },
          {
            type: "entity_ref",
            entityType: "domain",
            entityId: "domain_1",
            fallbackText: "三观",
          },
        ],
        previewText: "下面",
      },
    });
  });

  test("does not emit partial links for entity refs outside the catalog", () => {
    const result = finalStructuredOutputPartialFromValue(
      {
        parts: [
          { type: "text", text: "放在" },
          {
            type: "entity_ref",
            entityType: "domain",
            entityId: "missing",
            fallbackText: "三观",
          },
        ],
      },
      catalog,
    );

    expect(result).toEqual({ ok: false, error: "引用实体不存在: domain/missing" });
  });

  test("validates the complete final output", () => {
    expect(
      validateFinalStructuredOutput(
        {
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
        },
        catalog,
      ),
    ).toEqual({
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
  });

  test("rejects invalid final JSON", () => {
    expect(() =>
      validateFinalStructuredOutputJson(
        '{"parts":[{"type":"entity_ref","entityType":"domain","entityId":"missing"}]}',
        catalog,
      ),
    ).toThrow("引用实体不存在: domain/missing");
  });
});
