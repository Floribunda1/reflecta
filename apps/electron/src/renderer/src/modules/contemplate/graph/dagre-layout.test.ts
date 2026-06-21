import { describe, expect, test } from "vitest";
import { layoutDagreGraph, type DagreLayoutPosition } from "./dagre-layout";

function node(id: string) {
  return { id, width: 100, height: 40 };
}

function snapshot(positions: Map<string, DagreLayoutPosition>) {
  return [...positions.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, position]) => ({
      id,
      x: Math.round(position.x * 1000) / 1000,
      y: Math.round(position.y * 1000) / 1000,
    }));
}

describe("layoutDagreGraph", () => {
  test("handles an empty graph", () => {
    expect(layoutDagreGraph([], [])).toEqual(new Map());
  });

  test("places isolated nodes at finite coordinates", () => {
    const positions = layoutDagreGraph([node("a"), node("b")], []);

    expect(positions.size).toBe(2);
    for (const position of positions.values()) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }
  });

  test("spreads isolated nodes across columns", () => {
    const positions = layoutDagreGraph([node("a"), node("b"), node("c"), node("d")], []);

    expect(positions.get("b")!.x).toBeGreaterThan(positions.get("a")!.x);
    expect(positions.get("c")!.y).toBeGreaterThan(positions.get("a")!.y);
  });

  test("places a directed target to the right in LR layout", () => {
    const positions = layoutDagreGraph([node("a"), node("b")], [{ source: "a", target: "b" }]);

    expect(positions.get("b")!.x).toBeGreaterThan(positions.get("a")!.x);
  });

  test("keeps cyclic layouts deterministic", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "a" },
    ];

    expect(snapshot(layoutDagreGraph(nodes, edges))).toEqual(
      snapshot(layoutDagreGraph(nodes, edges)),
    );
  });
});
