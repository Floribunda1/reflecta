import { describe, expect, test } from "vitest";
import { buildGraphElementStates, type KnowledgeGraphData } from "./knowledge-graph-state";

const graph: KnowledgeGraphData = {
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

describe("knowledge graph focus", () => {
  test("keeps the selected node and its direct neighborhood visible", () => {
    expect(buildGraphElementStates(graph, { selectedId: "a", hoveredId: null })).toEqual({
      a: ["selected"],
      b: ["selected-neighbor"],
      c: ["selected-inactive"],
      isolated: ["selected-inactive"],
      "a-b": ["selected-neighbor"],
      "b-c": ["selected-inactive"],
    });
  });

  test("keeps selection while previewing another node", () => {
    expect(buildGraphElementStates(graph, { selectedId: "a", hoveredId: "c" })).toEqual({
      a: ["selected"],
      b: ["selected-neighbor"],
      c: ["hovered"],
      isolated: ["hover-inactive"],
      "a-b": ["selected-neighbor"],
      "b-c": ["hover-neighbor"],
    });
  });

  test("does not downgrade the selected node when it is also hovered", () => {
    expect(buildGraphElementStates(graph, { selectedId: "a", hoveredId: "a" })).toEqual({
      a: ["selected"],
      b: ["selected-neighbor"],
      c: ["selected-inactive"],
      isolated: ["selected-inactive"],
      "a-b": ["selected-neighbor"],
      "b-c": ["selected-inactive"],
    });
  });

  test("uses the same hover rules when no node is selected", () => {
    expect(buildGraphElementStates(graph, { selectedId: null, hoveredId: "b" })).toEqual({
      a: ["hover-neighbor"],
      b: ["hovered"],
      c: ["hover-neighbor"],
      isolated: ["hover-inactive"],
      "a-b": ["hover-neighbor"],
      "b-c": ["hover-neighbor"],
    });
  });

  test("switches selection without leaving stale states", () => {
    const states = buildGraphElementStates(graph, { selectedId: "c", hoveredId: null });

    expect(states.a).toEqual(["selected-inactive"]);
    expect(states.b).toEqual(["selected-neighbor"]);
    expect(states.c).toEqual(["selected"]);
    expect(Object.values(states).filter((state) => state.includes("selected"))).toHaveLength(1);
  });

  test("focuses an isolated node without inventing a neighborhood", () => {
    expect(buildGraphElementStates(graph, { selectedId: "isolated", hoveredId: null })).toEqual({
      a: ["selected-inactive"],
      b: ["selected-inactive"],
      c: ["selected-inactive"],
      isolated: ["selected"],
      "a-b": ["selected-inactive"],
      "b-c": ["selected-inactive"],
    });
  });

  test("clears every interaction state when focus is empty", () => {
    expect(buildGraphElementStates(graph, { selectedId: null, hoveredId: null })).toEqual({
      a: [],
      b: [],
      c: [],
      isolated: [],
      "a-b": [],
      "b-c": [],
    });
  });

  test("ignores stale focus identities", () => {
    expect(
      buildGraphElementStates(graph, {
        selectedId: "outside",
        hoveredId: "missing",
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
});
