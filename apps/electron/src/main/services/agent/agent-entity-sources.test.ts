import { describe, expect, test } from "vitest";
import { AgentEntitySourceRegistry } from "./agent-entity-sources";

describe("AgentEntitySourceRegistry", () => {
  test("assigns stable source ids and upgrades titles", () => {
    const registry = new AgentEntitySourceRegistry();

    const first = registry.addEntity(
      { type: "context", id: "ctx_1", title: "旧标题" },
      { kind: "user_context", messageId: "user_1" },
    );
    const second = registry.addEntity(
      { type: "context", id: "ctx_1", title: "新标题" },
      { kind: "tool_result", toolCallId: "tool_1", toolName: "context_get" },
    );

    expect(first.sourceId).toBe("S1");
    expect(second.sourceId).toBe("S1");
    expect(registry.snapshot()).toEqual([
      {
        sourceId: "S1",
        entity: { type: "context", id: "ctx_1", title: "新标题" },
        origin: { kind: "user_context", messageId: "user_1" },
      },
    ]);
  });

  test("decorates recognized tool entities with refs and strips raw ids from model-facing output", () => {
    const registry = new AgentEntitySourceRegistry();

    const decorated = registry.decorateToolOutput("retrieve_knowledge", "tool_1", {
      candidates: [
        {
          understanding: { id: "u_1", title: "Feedback Loop", body: "body" },
          matchedContexts: [{ context: { id: "ctx_1", title: "一次复盘", excerpt: "excerpt" } }],
        },
      ],
    });

    expect(decorated).toEqual({
      candidates: [
        {
          understanding: { ref: "[[ref:S1]]", title: "Feedback Loop", body: "body" },
          matchedContexts: [
            { context: { ref: "[[ref:S2]]", title: "一次复盘", excerpt: "excerpt" } },
          ],
        },
      ],
    });
    expect(registry.resolveRef("S2", "context")).toEqual({
      type: "context",
      id: "ctx_1",
      title: "一次复盘",
    });
  });

  test("decorates flat retrieval candidates with refs and strips raw ids", () => {
    const registry = new AgentEntitySourceRegistry();

    const decorated = registry.decorateToolOutput("retrieve_knowledge", "tool_1", {
      candidates: [
        {
          id: "u_1",
          title: "Feedback Loop",
          snippet: "snippet",
          matchedContexts: [
            {
              contextId: "ctx_1",
              title: "一次复盘",
              snippet: "context snippet",
            },
          ],
          suggestedRead: {
            tool: "understanding_get",
            input: { understandingId: "u_1", includeContexts: true },
          },
        },
      ],
    });

    expect(decorated).toEqual({
      candidates: [
        {
          ref: "[[ref:S1]]",
          title: "Feedback Loop",
          snippet: "snippet",
          matchedContexts: [
            {
              ref: "[[ref:S2]]",
              title: "一次复盘",
              snippet: "context snippet",
            },
          ],
          suggestedRead: {
            tool: "understanding_get",
            input: { ref: "[[ref:S1]]", includeContexts: true },
          },
        },
      ],
    });
  });

  test("decorates root read tool entity outputs and relationship ids", () => {
    const registry = new AgentEntitySourceRegistry();

    const decorated = registry.decorateToolOutput("understanding_get", "tool_1", {
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

    expect(decorated).toEqual({
      ref: "[[ref:S1]]",
      title: "Feedback Loop",
      body: "body",
      domainRefs: ["[[ref:S2]]"],
      contexts: [
        {
          ref: "[[ref:S3]]",
          understandingRef: "[[ref:S1]]",
          title: "一次复盘",
          content: "content",
        },
      ],
    });
  });

  test("decorates root entity lists and id-keyed context maps", () => {
    const registry = new AgentEntitySourceRegistry();

    const decorated = registry.decorateToolOutput("understanding_list", "tool_1", {
      understandings: [{ id: "u_1", title: "Feedback Loop" }],
      contextsByUnderstandingId: {
        u_1: [{ id: "ctx_1", understandingId: "u_1", title: "一次复盘" }],
      },
    });

    expect(decorated).toEqual({
      understandings: [{ ref: "[[ref:S1]]", title: "Feedback Loop" }],
      contextsByUnderstandingRef: [
        {
          understandingRef: "[[ref:S1]]",
          contexts: [{ ref: "[[ref:S2]]", understandingRef: "[[ref:S1]]", title: "一次复盘" }],
        },
      ],
    });
  });
});
