import { describe, expect, test } from "vitest";
import type { AgentCitationSource, AgentEntityCatalogEntry } from "@shared/agent";
import {
  buildCitationSources,
  extractCitedSources,
  formatCitationSourcesForPrompt,
  mergeCitationSources,
} from "./agent-citations";

const entries: AgentEntityCatalogEntry[] = [
  {
    key: "understanding:u_1",
    entity: { type: "understanding", id: "u_1", title: "第一条理解" },
    origin: { kind: "user_context", messageId: "msg_1" },
  },
  {
    key: "domain:d_1",
    entity: { type: "domain", id: "d_1", title: "产品设计" },
    origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
  },
];

describe("buildCitationSources", () => {
  test("builds stable numbered sources from catalog order", () => {
    expect(buildCitationSources(entries)).toEqual([
      {
        index: 1,
        entity: { type: "understanding", id: "u_1", title: "第一条理解" },
        origin: { kind: "user_context", messageId: "msg_1" },
      },
      {
        index: 2,
        entity: { type: "domain", id: "d_1", title: "产品设计" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_list" },
      },
    ]);
  });
});

describe("mergeCitationSources", () => {
  test("appends new tool-discovered entities without renumbering existing sources", () => {
    const current = buildCitationSources([
      {
        key: "understanding:u_1",
        entity: { type: "understanding", id: "u_1" },
        origin: { kind: "user_context", messageId: "msg_1" },
      },
    ]);
    const merged = mergeCitationSources(current, entries);

    expect(merged.map((source) => [source.index, source.entity.id])).toEqual([
      [1, "u_1"],
      [2, "d_1"],
    ]);
    expect(merged[0]?.entity.title).toBe("第一条理解");
  });
});

describe("extractCitedSources", () => {
  test("preserves sparse cited indices", () => {
    const sources: AgentCitationSource[] = Array.from({ length: 10 }, (_, index) => ({
      index: index + 1,
      entity: { type: "understanding", id: `u_${index + 1}`, title: `第 ${index + 1} 条理解` },
    }));
    sources[2] = { index: 3, entity: { type: "context", id: "ctx_1", title: "一次复盘" } };
    sources[9] = {
      index: 10,
      entity: { type: "understanding", id: "u_10", title: "第十条理解" },
    };

    const cited = extractCitedSources("核心来自 [3]，另一个支撑来自 [10]。", sources);

    expect(cited.map((source) => source.index)).toEqual([3, 10]);
    expect(cited.map((source) => source.entity.id)).toEqual(["ctx_1", "u_10"]);
  });

  test("ignores citations in inline code, fenced code, links, images, and unknown indices", () => {
    const sources = buildCitationSources(entries);
    const markdown = [
      "真实引用 [1]",
      "`[2]`",
      "```",
      "[1]",
      "```",
      "[2](https://example.test)",
      "![1](image.png)",
      "[999]",
    ].join("\n");

    expect(extractCitedSources(markdown, sources).map((source) => source.index)).toEqual([1]);
  });
});

describe("formatCitationSourcesForPrompt", () => {
  test("formats sources as numbered prompt lines", () => {
    expect(formatCitationSourcesForPrompt(buildCitationSources(entries))).toContain(
      "[1] Understanding: 第一条理解; id=u_1",
    );
    expect(formatCitationSourcesForPrompt(buildCitationSources(entries))).toContain(
      "Tool calls must use the real id",
    );
  });
});
