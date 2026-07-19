import { describe, expect, it } from "vitest";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import {
  buildGraphSelectionStates,
  buildKnowledgeGraphData,
  splitKnowledgeGraphData,
} from "./graph-data";

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
  it("keeps isolated nodes and only visible real connections", () => {
    const data = buildKnowledgeGraphData([
      understanding("a", ["b", "outside"]),
      understanding("b", ["a"]),
      understanding("isolated", []),
    ]);

    expect(data.nodes.map((node) => node.id)).toEqual(["a", "b", "isolated"]);
    expect(data.edges).toEqual([
      {
        id: "connection:a->b",
        source: "a",
        target: "b",
      },
      {
        id: "connection:b->a",
        source: "b",
        target: "a",
      },
    ]);
  });

  it("uses the shared title fallback", () => {
    const data = buildKnowledgeGraphData([understanding("a", [], null)]);

    expect(data.nodes[0]?.data.title).toBe("正文 a");
  });

  it("separates connected and unconnected understandings without dropping either", () => {
    const data = buildKnowledgeGraphData([
      understanding("a", ["b"]),
      understanding("b"),
      understanding("isolated"),
    ]);

    const split = splitKnowledgeGraphData(data);

    expect(split.connected.nodes.map((node) => node.id)).toEqual(["a", "b"]);
    expect(split.connected.edges).toEqual([
      {
        id: "connection:a->b",
        source: "a",
        target: "b",
      },
    ]);
    expect(split.unconnected.map((node) => node.id)).toEqual(["isolated"]);
  });
});

describe("buildGraphSelectionStates", () => {
  it("focuses the selected neighborhood and dims unrelated relationship islands", () => {
    const data = buildKnowledgeGraphData([
      understanding("a", ["b"]),
      understanding("b", ["c"]),
      understanding("c"),
      understanding("d", ["e"]),
      understanding("e"),
    ]);

    expect(buildGraphSelectionStates(data, "b")).toEqual({
      a: ["related"],
      b: ["selected"],
      c: ["related"],
      d: ["dimmed"],
      e: ["dimmed"],
      "connection:a->b": ["selected"],
      "connection:b->c": ["selected"],
      "connection:d->e": ["dimmed"],
    });
  });
});
