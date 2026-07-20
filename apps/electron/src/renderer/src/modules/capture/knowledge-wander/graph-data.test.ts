import { describe, expect, test } from "vitest";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { buildGraphElementStates, buildKnowledgeGraphData } from "./graph-data";

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

const focusData = {
  nodes: [
    { id: "a", data: { title: "A", degree: 1 } },
    { id: "b", data: { title: "B", degree: 2 } },
    { id: "c", data: { title: "C", degree: 1 } },
    { id: "isolated", data: { title: "Isolated", degree: 0 } },
  ],
  edges: [
    { id: "a-b", source: "a", target: "b" },
    { id: "b-c", source: "b", target: "c" },
  ],
};

describe("buildGraphElementStates", () => {
  test("keeps one selected node and its direct neighborhood clear", () => {
    expect(
      buildGraphElementStates(focusData, {
        selectedId: "a",
        hoveredId: null,
      }),
    ).toEqual({
      a: ["selected"],
      b: ["selected-neighbor"],
      c: ["selected-inactive"],
      isolated: ["selected-inactive"],
      "a-b": ["selected-neighbor"],
      "b-c": ["selected-inactive"],
    });
  });

  test("keeps selection visible while another node is hovered", () => {
    const hoverStates = buildGraphElementStates(focusData, {
      selectedId: "a",
      hoveredId: "c",
    });

    expect(hoverStates).toEqual({
      a: ["selected"],
      b: ["selected-neighbor"],
      c: ["hovered"],
      isolated: ["hover-inactive"],
      "a-b": ["selected-neighbor"],
      "b-c": ["hover-neighbor"],
    });
    expect(
      buildGraphElementStates(focusData, {
        selectedId: "a",
        hoveredId: null,
      }),
    ).toEqual({
      a: ["selected"],
      b: ["selected-neighbor"],
      c: ["selected-inactive"],
      isolated: ["selected-inactive"],
      "a-b": ["selected-neighbor"],
      "b-c": ["selected-inactive"],
    });
  });

  test("does not downgrade the selected node when it is also hovered", () => {
    expect(
      buildGraphElementStates(focusData, {
        selectedId: "a",
        hoveredId: "a",
      }),
    ).toEqual({
      a: ["selected"],
      b: ["selected-neighbor"],
      c: ["selected-inactive"],
      isolated: ["selected-inactive"],
      "a-b": ["selected-neighbor"],
      "b-c": ["selected-inactive"],
    });
  });

  test("uses the same hover rules when no node is selected", () => {
    expect(
      buildGraphElementStates(focusData, {
        selectedId: null,
        hoveredId: "b",
      }),
    ).toEqual({
      a: ["hover-neighbor"],
      b: ["hovered"],
      c: ["hover-neighbor"],
      isolated: ["hover-inactive"],
      "a-b": ["hover-neighbor"],
      "b-c": ["hover-neighbor"],
    });
  });

  test("switches selection without leaving stale states on the previous node", () => {
    const states = buildGraphElementStates(focusData, {
      selectedId: "c",
      hoveredId: null,
    });

    expect(states.a).toEqual(["selected-inactive"]);
    expect(states.b).toEqual(["selected-neighbor"]);
    expect(states.c).toEqual(["selected"]);
    expect(Object.values(states).filter((value) => value.includes("selected"))).toHaveLength(1);
  });

  test("focuses an isolated node without inventing a neighborhood", () => {
    expect(
      buildGraphElementStates(focusData, {
        selectedId: "isolated",
        hoveredId: null,
      }),
    ).toEqual({
      a: ["selected-inactive"],
      b: ["selected-inactive"],
      c: ["selected-inactive"],
      isolated: ["selected"],
      "a-b": ["selected-inactive"],
      "b-c": ["selected-inactive"],
    });
  });

  test("clears every interaction state when neither focus is active", () => {
    expect(
      buildGraphElementStates(focusData, {
        selectedId: null,
        hoveredId: null,
      }),
    ).toEqual({
      a: [],
      b: [],
      c: [],
      isolated: [],
      "a-b": [],
      "b-c": [],
    });
  });

  test("ignores a stale hover id and falls back to the valid selection", () => {
    expect(
      buildGraphElementStates(focusData, {
        selectedId: "a",
        hoveredId: "outside-current-domain",
      }),
    ).toEqual({
      a: ["selected"],
      b: ["selected-neighbor"],
      c: ["selected-inactive"],
      isolated: ["selected-inactive"],
      "a-b": ["selected-neighbor"],
      "b-c": ["selected-inactive"],
    });
  });
});
