import { describe, expect, test } from "vitest";
import { normalizeAgentTextParts, validateFinalAnswerParts } from "./agent-text-parts";

describe("normalizeAgentTextParts", () => {
  test("normalizes entity refs from catalog without title matching", () => {
    const result = normalizeAgentTextParts(
      [
        { type: "text", text: "这个理解适合放在" },
        { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
        { type: "text", text: "下面。AI 只是普通文本。" },
      ],
      [
        {
          key: "domain:domain_1",
          entity: { type: "domain", id: "domain_1", title: "三观" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
        },
        {
          key: "domain:domain_ai",
          entity: { type: "domain", id: "domain_ai", title: "AI" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
        },
      ],
    );

    expect(result.text).toBe("这个理解适合放在三观下面。AI 只是普通文本。");
    expect(result.parts).toEqual([
      { type: "text", text: "这个理解适合放在" },
      { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
      { type: "text", text: "下面。AI 只是普通文本。" },
    ]);
  });

  test("downgrades missing entity refs to fallback text", () => {
    const result = normalizeAgentTextParts(
      [{ type: "entity_ref", entityType: "domain", entityId: "missing", fallbackText: "三观" }],
      [],
    );

    expect(result).toEqual({ text: "三观", parts: [{ type: "text", text: "三观" }] });
  });

  test("validates final answer parts against the entity catalog", () => {
    const result = validateFinalAnswerParts(
      [
        { type: "text", text: "放在" },
        { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
        { type: "text", text: "下面。" },
      ],
      [
        {
          key: "domain:domain_1",
          entity: { type: "domain", id: "domain_1", title: "三观" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
        },
      ],
    );

    expect(result).toEqual({
      ok: true,
      text: "放在三观下面。",
      parts: [
        { type: "text", text: "放在" },
        { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
        { type: "text", text: "下面。" },
      ],
    });
  });

  test("rejects final answer parts when an entity id is missing from the catalog", () => {
    const result = validateFinalAnswerParts(
      [{ type: "entity_ref", entityType: "domain", entityId: "missing", fallbackText: "三观" }],
      [],
    );

    expect(result).toEqual({
      ok: false,
      error: "引用实体不存在: domain/missing",
    });
  });
});
