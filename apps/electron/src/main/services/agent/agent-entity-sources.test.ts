import { describe, expect, test } from "vitest";
import { AgentEntitySourceRegistry } from "./agent-entity-sources";

function registryWithSourceIds(...sourceIds: string[]) {
  let index = 0;
  return new AgentEntitySourceRegistry([], () => sourceIds[index++] ?? `rf_extra_${index}`);
}

describe("AgentEntitySourceRegistry", () => {
  test("assigns stable source ids and upgrades titles", () => {
    const registry = registryWithSourceIds("rf_ctx");

    const first = registry.addEntity(
      { type: "context", id: "ctx_1", title: "旧标题" },
      { kind: "user_context", messageId: "user_1" },
    );
    const second = registry.addEntity(
      { type: "context", id: "ctx_1", title: "新标题" },
      { kind: "tool_result", toolCallId: "tool_1", toolName: "context_get" },
    );

    expect(first.sourceId).toBe("rf_ctx");
    expect(second.sourceId).toBe("rf_ctx");
    expect(registry.snapshot()).toEqual([
      {
        sourceId: "rf_ctx",
        entity: { type: "context", id: "ctx_1", title: "新标题" },
        origin: { kind: "user_context", messageId: "user_1" },
      },
    ]);
  });

  test("keeps legacy source ids resolvable but allocates opaque ids for new mentions", () => {
    const registry = new AgentEntitySourceRegistry(
      [
        {
          sourceId: "S1",
          entity: { type: "context", id: "ctx_1", title: "旧标题" },
          origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "retrieve_knowledge" },
        },
      ],
      () => "rf_ctx",
    );

    const source = registry.addEntity(
      { type: "context", id: "ctx_1", title: "新标题" },
      { kind: "user_context", messageId: "user_1" },
    );

    expect(source.sourceId).toBe("rf_ctx");
    expect(registry.resolveRef("[[ref:S1]]", "context")).toEqual({
      type: "context",
      id: "ctx_1",
      title: "旧标题",
    });
    expect(registry.resolveRef("[[ref:rf_ctx]]", "context")).toEqual({
      type: "context",
      id: "ctx_1",
      title: "新标题",
    });
  });

  test("decorates recognized tool entities with refs and strips raw ids from model-facing output", () => {
    const registry = registryWithSourceIds("rf_understanding", "rf_context");

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
          understanding: { ref: "[[ref:rf_understanding]]", title: "Feedback Loop", body: "body" },
          matchedContexts: [
            { context: { ref: "[[ref:rf_context]]", title: "一次复盘", excerpt: "excerpt" } },
          ],
        },
      ],
    });
    expect(registry.resolveRef("rf_context", "context")).toEqual({
      type: "context",
      id: "ctx_1",
      title: "一次复盘",
    });
  });

  test("decorates flat retrieval candidates with refs and strips raw ids", () => {
    const registry = registryWithSourceIds("rf_understanding", "rf_context");

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
          ref: "[[ref:rf_understanding]]",
          title: "Feedback Loop",
          snippet: "snippet",
          matchedContexts: [
            {
              ref: "[[ref:rf_context]]",
              title: "一次复盘",
              snippet: "context snippet",
            },
          ],
          suggestedRead: {
            tool: "understanding_get",
            input: { ref: "[[ref:rf_understanding]]", includeContexts: true },
          },
        },
      ],
    });
  });

  test("decorates root read tool entity outputs and relationship ids", () => {
    const registry = registryWithSourceIds("rf_understanding", "rf_domain", "rf_context");

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
      ref: "[[ref:rf_understanding]]",
      title: "Feedback Loop",
      body: "body",
      domainRefs: ["[[ref:rf_domain]]"],
      contexts: [
        {
          ref: "[[ref:rf_context]]",
          understandingRef: "[[ref:rf_understanding]]",
          title: "一次复盘",
          content: "content",
        },
      ],
    });
  });

  test("decorates root entity lists and id-keyed context maps", () => {
    const registry = registryWithSourceIds("rf_understanding", "rf_context");

    const decorated = registry.decorateToolOutput("understanding_list", "tool_1", {
      understandings: [{ id: "u_1", title: "Feedback Loop" }],
      contextsByUnderstandingId: {
        u_1: [{ id: "ctx_1", understandingId: "u_1", title: "一次复盘" }],
      },
    });

    expect(decorated).toEqual({
      understandings: [{ ref: "[[ref:rf_understanding]]", title: "Feedback Loop" }],
      contextsByUnderstandingRef: [
        {
          understandingRef: "[[ref:rf_understanding]]",
          contexts: [
            {
              ref: "[[ref:rf_context]]",
              understandingRef: "[[ref:rf_understanding]]",
              title: "一次复盘",
            },
          ],
        },
      ],
    });
  });
});
