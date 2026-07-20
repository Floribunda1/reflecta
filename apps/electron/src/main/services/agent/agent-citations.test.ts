import { describe, expect, test } from "vitest";
import type { AgentEntityCatalogEntry } from "@shared/agent";
import { formatEntityRecordsForPrompt, RUNTIME_ENTITY_CATALOG_OPEN_TAG } from "./agent-citations";

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

describe("formatEntityRecordsForPrompt", () => {
  test("exposes explicit entity type, bare id, citation, and title", () => {
    const prompt = formatEntityRecordsForPrompt(entries);

    expect(prompt).toContain(
      '{"type":"understanding","id":"u_1","citation":"[[u:u_1]]","title":"第一条理解"}',
    );
    expect(prompt).toContain(
      '{"type":"domain","id":"d_1","citation":"[[d:d_1]]","title":"产品设计"}',
    );
  });

  test("deduplicates an entity by type and id", () => {
    expect(
      formatEntityRecordsForPrompt([...entries, entries[0]!]).match(/\[\[u:u_1\]\]/g),
    ).toHaveLength(1);
  });

  test("formats context and safely encodes missing or special titles", () => {
    const prompt = formatEntityRecordsForPrompt([
      {
        key: "context:c_1",
        entity: { type: "context", id: "c_1", title: '复盘 "第一轮"\n下一行' },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "context_get" },
      },
      {
        key: "understanding:u_2",
        entity: { type: "understanding", id: "u_2" },
        origin: { kind: "user_context", messageId: "msg_1" },
      },
    ]);
    const records = prompt
      .split(`${RUNTIME_ENTITY_CATALOG_OPEN_TAG}\n`)[1]!
      .split("\n</reflecta_entities>")[0]!
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(records).toEqual([
      {
        type: "context",
        id: "c_1",
        citation: "[[c:c_1]]",
        title: '复盘 "第一轮"\n下一行',
      },
      { type: "understanding", id: "u_2", citation: "[[u:u_2]]", title: null },
    ]);
  });
});
