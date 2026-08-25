import { expect, test } from "vitest";
import { agentLayoutScenarios, agentCanvasDocument } from "./canvas-story-fixtures";
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

test("every agent layout scenario stays clean: groups bound children, top-level nodes don't overlap", () => {
  for (const scenario of agentLayoutScenarios) {
    const byId = new Map(
      toX6Cells(scenario.document)
        .filter((c) => c.shape !== "edge")
        .map((c) => [c.id, box(c)]),
    );
    // 组必须包含其子节点（toX6Cells 已是绝对坐标）
    for (const child of byId.values()) {
      if (!child.parent) continue;
      const parent = byId.get(child.parent)!;
      expect(child.x, `${scenario.title}: ${child.id} 超出组左`).toBeGreaterThanOrEqual(parent.x);
      expect(child.x + child.width).toBeLessThanOrEqual(parent.x + parent.width);
      expect(child.y).toBeGreaterThanOrEqual(parent.y);
      expect(child.y + child.height).toBeLessThanOrEqual(parent.y + parent.height);
    }
    // 顶层节点（含组）互不重叠
    const top = [...byId.values()].filter((c) => !c.parent);
    for (const [i, a] of top.entries()) {
      for (const b of top.slice(i + 1)) {
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlaps, `${scenario.title}: ${a.id} 与 ${b.id} 重叠`).toBe(false);
      }
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
