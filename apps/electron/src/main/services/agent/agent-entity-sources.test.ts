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

  test("decorates recognized tool entities with typed refs and keeps raw ids", () => {
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
          understanding: {
            id: "u_1",
            ref: "[[understanding:u_1]]",
            title: "Feedback Loop",
            body: "body",
          },
          matchedContexts: [
            {
              context: {
                id: "ctx_1",
                ref: "[[context:ctx_1]]",
                title: "一次复盘",
                excerpt: "excerpt",
              },
            },
          ],
        },
      ],
    });
  });

  test("decorates flat retrieval candidates with typed refs and keeps tool input ids", () => {
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
          id: "u_1",
          ref: "[[understanding:u_1]]",
          title: "Feedback Loop",
          snippet: "snippet",
          matchedContexts: [
            {
              contextId: "ctx_1",
              contextRef: "[[context:ctx_1]]",
              ref: "[[context:ctx_1]]",
              title: "一次复盘",
              snippet: "context snippet",
            },
          ],
          suggestedRead: {
            tool: "understanding_get",
            input: {
              understandingId: "u_1",
              understandingRef: "[[understanding:u_1]]",
              includeContexts: true,
            },
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
      id: "u_1",
      ref: "[[understanding:u_1]]",
      title: "Feedback Loop",
      body: "body",
      domainIds: ["domain_1"],
      domainRefs: ["[[domain:domain_1]]"],
      contexts: [
        {
          id: "ctx_1",
          ref: "[[context:ctx_1]]",
          understandingId: "u_1",
          understandingRef: "[[understanding:u_1]]",
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
      understandings: [{ id: "u_1", ref: "[[understanding:u_1]]", title: "Feedback Loop" }],
      contextsByUnderstandingId: {
        u_1: [
          {
            id: "ctx_1",
            ref: "[[context:ctx_1]]",
            understandingId: "u_1",
            understandingRef: "[[understanding:u_1]]",
            title: "一次复盘",
          },
        ],
      },
      contextsByUnderstandingRef: [
        {
          understandingId: "u_1",
          understandingRef: "[[understanding:u_1]]",
          contexts: [
            {
              id: "ctx_1",
              ref: "[[context:ctx_1]]",
              understandingId: "u_1",
              understandingRef: "[[understanding:u_1]]",
              title: "一次复盘",
            },
          ],
        },
      ],
    });
  });
});
