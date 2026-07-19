import { describe, expect, test } from "vitest";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { buildKnowledgeGraphData } from "./graph-data";

function understanding(
  id: string,
  connectionIds: string[] = [],
  title: string | null = id,
): UnderstandingSummaryDTO {
  return {
    id,
    title,
    body: title ? "" : `正文 ${id}`,
    domainIds: [],
    contextCount: 0,
    connectionCount: connectionIds.length,
    connectionIds,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("buildKnowledgeGraphData", () => {
  test("keeps every visible understanding including isolated nodes", () => {
    const data = buildKnowledgeGraphData([
      understanding("linked", ["target"]),
      understanding("target"),
      understanding("isolated"),
    ]);

    expect(data.nodes.map(({ id }) => id)).toEqual(["isolated", "linked", "target"]);
    expect(data.nodes.find(({ id }) => id === "isolated")?.data.degree).toBe(0);
  });

  test("keeps only visible real connections and treats reciprocal links as one edge", () => {
    const data = buildKnowledgeGraphData([
      understanding("a", ["b", "outside", "a"]),
      understanding("b", ["a"]),
      understanding("isolated"),
    ]);

    expect(data.edges).toEqual([
      {
        id: "connection:a--b",
        source: "a",
        target: "b",
      },
    ]);
    expect(data.nodes.find(({ id }) => id === "a")?.data.degree).toBe(1);
    expect(data.nodes.find(({ id }) => id === "b")?.data.degree).toBe(1);
  });

  test("uses the shared understanding title fallback", () => {
    const data = buildKnowledgeGraphData([understanding("untitled", [], null)]);

    expect(data.nodes[0]?.data.title).toBe("正文 untitled");
  });
});
