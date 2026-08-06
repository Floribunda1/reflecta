import { describe, expect, test } from "vitest";
import { AgentEntityCatalog } from "./agent-entity-catalog";

describe("AgentEntityCatalog", () => {
  test("stores stable entity ids without display refs", () => {
    const catalog = new AgentEntityCatalog();

    catalog.addEntity(
      { type: "domain", id: "domain_1", title: "三观" },
      { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
    );

    expect(catalog.snapshot()).toEqual([
      {
        key: "domain:domain_1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
      },
    ]);
    expect(JSON.stringify(catalog.snapshot())).not.toContain("ref");
    expect(JSON.stringify(catalog.snapshot())).not.toContain("D1");
  });

  test("upgrades titles by entity key", () => {
    const catalog = new AgentEntityCatalog();

    catalog.addEntity(
      { type: "context", id: "ctx_1", title: "旧标题" },
      { kind: "user_context", messageId: "user_1" },
    );
    catalog.addEntity(
      { type: "context", id: "ctx_1", title: "新标题" },
      { kind: "tool_result", toolCallId: "tool_1", toolName: "context_get" },
    );

    expect(catalog.snapshot()).toEqual([
      {
        key: "context:ctx_1",
        entity: { type: "context", id: "ctx_1", title: "新标题" },
        origin: { kind: "user_context", messageId: "user_1" },
      },
    ]);
  });

  test("collects entities from read tool outputs without mutating model-facing output", () => {
    const catalog = new AgentEntityCatalog();
    const output = {
      id: "u_1",
      title: "Feedback Loop",
      body: "body",
      domainIds: ["domain_1"],
      contexts: [
        {
          id: "ctx_1",
          understandingId: "u_1",
          title: "一次复盘",
          content: "content",
        },
      ],
    };

    catalog.collectToolOutput("understanding_get", "tool_1", output);

    expect(output).toEqual({
      id: "u_1",
      title: "Feedback Loop",
      body: "body",
      domainIds: ["domain_1"],
      contexts: [
        {
          id: "ctx_1",
          understandingId: "u_1",
          title: "一次复盘",
          content: "content",
        },
      ],
    });
    expect(catalog.snapshot()).toEqual([
      {
        key: "understanding:u_1",
        entity: { type: "understanding", id: "u_1", title: "Feedback Loop" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "understanding_get" },
      },
      {
        key: "domain:domain_1",
        entity: { type: "domain", id: "domain_1" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "understanding_get" },
      },
      {
        key: "context:ctx_1",
        entity: { type: "context", id: "ctx_1", title: "一次复盘" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "understanding_get" },
      },
    ]);
    expect(JSON.stringify(output)).not.toContain("Ref");
    expect(JSON.stringify(output)).not.toContain("[[");
  });

  test("collects flat retrieval candidates and suggested reads", () => {
    const catalog = new AgentEntityCatalog();

    catalog.collectToolOutput("retrieve_knowledge", "tool_1", {
      candidates: [
        {
          id: "u_1",
          title: "Feedback Loop",
          snippet: "snippet",
          matches: [
            {
              entityType: "context",
              id: "ctx_1",
              medium: "experience",
              snippet: "context snippet",
              channels: ["dense"],
              rank: 0,
              reason: "semantic hit on Context",
            },
          ],
          suggestedRead: {
            tool: "understanding_get",
            input: { understandingId: "u_1", includeContexts: true },
          },
        },
      ],
    });

    expect(catalog.snapshot()).toEqual(
      expect.arrayContaining([
        {
          key: "understanding:u_1",
          entity: { type: "understanding", id: "u_1", title: "Feedback Loop" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "retrieve_knowledge" },
        },
        {
          key: "context:ctx_1",
          entity: { type: "context", id: "ctx_1" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "retrieve_knowledge" },
        },
      ]),
    );
    expect(catalog.snapshot()).toHaveLength(2);
  });
});
