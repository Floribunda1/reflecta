import { expect, test } from "vitest";
import { agentCanvasDocument } from "./canvas-story-fixtures";
import { toX6Cells } from "./graph-document";

type CellBox = {
  id: string;
  parent?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
const box = (raw: unknown): CellBox => {
  const cell = raw as {
    id?: string;
    parent?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  return {
    id: cell.id ?? "",
    parent: cell.parent,
    x: cell.x ?? 0,
    y: cell.y ?? 0,
    width: cell.width ?? 0,
    height: cell.height ?? 0,
  };
};

test("converts an agent-created document into positioned X6 cells", () => {
  const cells = toX6Cells(agentCanvasDocument);
  const grouped = cells.find((cell) => cell.id === "agent-risk");
  const edges = cells.filter((cell) => cell.shape === "edge");

  expect(cells).toHaveLength(
    agentCanvasDocument.elements.length + agentCanvasDocument.edges.length,
  );
  // toX6Cells 已把组内子元素相对坐标换算为绝对坐标（与真实 normalizeCanvasChanges 一致）。
  expect(grouped).toMatchObject({
    parent: "agent-options",
    x: 12 + 337, // 组内 rel(12,152) + 组绝(337,12)
    y: 152 + 12,
  });
  expect(edges).toHaveLength(agentCanvasDocument.edges.length);
  expect(edges[0]).toMatchObject({
    source: { cell: "agent-question", port: "right" },
    target: { cell: "agent-risk", port: "left" },
  });
});

test("agent-created layout keeps top-level nodes non-overlapping", () => {
  const cells = toX6Cells(agentCanvasDocument);
  const topLevel = cells.filter((c) => c.shape !== "edge" && !c.parent).map((c) => box(c));
  expect(topLevel.map((c) => c.id)).toEqual(["agent-question", "agent-options", "agent-decision"]);
  for (const [i, a] of topLevel.entries()) {
    for (const b of topLevel.slice(i + 1)) {
      const overlaps =
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
    }
  }
});
test("agent-created group contains its children without overflow", () => {
  const byId = new Map(toX6Cells(agentCanvasDocument).map((c) => [c.id, box(c)]));
  const group = byId.get("agent-options")!;
  for (const id of ["agent-risk", "agent-cost"]) {
    const child = byId.get(id)!;
    expect(child.parent).toBe("agent-options");
    expect(child.x).toBeGreaterThanOrEqual(group.x);
    expect(child.x + child.width).toBeLessThanOrEqual(group.x + group.width);
    expect(child.y).toBeGreaterThanOrEqual(group.y);
    expect(child.y + child.height).toBeLessThanOrEqual(group.y + group.height);
  }
});

test("every agent edge connects existing cells with right/left ports", () => {
  const cells = toX6Cells(agentCanvasDocument);
  const ids = new Set(cells.map((c) => c.id));
  const edges = cells.filter((cell) => cell.shape === "edge");
  for (const e of edges) {
    expect(e.source?.cell).toBeTruthy();
    expect(ids.has(e.source.cell)).toBe(true);
    expect(ids.has(e.target.cell)).toBe(true);
    expect(e.source?.port).toBe("right");
    expect(e.target?.port).toBe("left");
  }
});
