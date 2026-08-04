import { describe, expect, test } from "vitest";
import {
  DEFAULT_COMPACTION_SETTINGS,
  shouldCompact,
  type ContextEvent,
} from "@earendil-works/pi-coding-agent";
import {
  buildReflectaCompactionPrompt,
  compactionSummaryMaxTokens,
  contextCompactionSettings,
  loadAgentContextCompactionPrompt,
} from "./pi-context-compaction";

const runtimeCatalog = `

<reflecta_entities source="reflecta-runtime" version="1">
{"type":"context","id":"ctx_1","citation":"[[c:ctx_1]]","title":"一次复盘"}
</reflecta_entities>`;

describe("Reflecta context compaction", () => {
  test("uses Pi's near-limit compaction defaults", () => {
    expect(contextCompactionSettings).toBe(DEFAULT_COMPACTION_SETTINGS);
    expect(shouldCompact(160_001, 272_000, contextCompactionSettings)).toBe(false);
    expect(shouldCompact(255_617, 272_000, contextCompactionSettings)).toBe(true);
  });

  test("caps the checkpoint independently from the provider output limit", () => {
    expect(compactionSummaryMaxTokens({ contextWindow: 128_000, maxTokens: 32_000 })).toBe(6_000);
    expect(compactionSummaryMaxTokens({ contextWindow: 8_000, maxTokens: 32_000 })).toBe(640);
  });

  test("preserves provenance and citations while excluding the runtime Entity Catalog", () => {
    const messages: ContextEvent["messages"] = [
      {
        role: "user",
        content: `用户要求保留引用 [[c:ctx_1]]${runtimeCatalog}`,
        timestamp: 1,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "这是尚未被用户确认的建议" }],
        api: "openai-responses",
        provider: "openai",
        model: "gpt-test",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        timestamp: 2,
      },
    ];

    const prompt = buildReflectaCompactionPrompt({
      firstKeptEntryId: "entry_2",
      messagesToSummarize: messages,
      turnPrefixMessages: [{ role: "user", content: "当前轮次前半段", timestamp: 3 }],
      tokensBefore: 100_000,
      previousSummary: `旧检查点仍需保留 [[u:understanding_1]]${runtimeCatalog}`,
    });

    expect(prompt).toContain("旧检查点仍需保留 [[u:understanding_1]]");
    expect(prompt).toContain("用户要求保留引用 [[c:ctx_1]]");
    expect(prompt).toContain("这是尚未被用户确认的建议");
    expect(prompt).toContain("当前轮次前半段");
    expect(prompt).not.toContain('<reflecta_entities source="reflecta-runtime"');
    expect(prompt).not.toContain('"title":"一次复盘"');
  });

  test("loads the static compaction instructions from the dedicated prompt file", () => {
    const prompt = loadAgentContextCompactionPrompt();

    expect(prompt).toContain("You are performing a CONTEXT CHECKPOINT COMPACTION.");
    expect(prompt).toContain("Current progress and key decisions made");
    expect(prompt).toContain("Be concise, structured, and focused");
  });
});
