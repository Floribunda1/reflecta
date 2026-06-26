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
});
