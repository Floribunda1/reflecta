import { Effect } from "effect";
import { expect, test } from "vitest";
import { normalizeCanvasChanges } from "@reflecta/shared";
import { agentScenarioInputs } from "./canvas-story-fixtures";
import { toX6Cells } from "./graph-document";

type CellBox = { id: string; parent?: string; x: number; y: number; width: number; height: number };
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

/**
 * 对每个 agent 场景跑真实 `normalizeCanvasChanges`（shared，ELK），并断言布局不变量：
 * 顶层节点互不重叠、组包住子节点、每条边连接已存在的 cell。几何 live 生成，
 * 与 storybook 渲染同一真源——布局规则一变这里的断言就是验收锚点。
 */
test("every agent layout scenario stays clean (live from normalizeCanvasChanges)", async () => {
  for (const scenario of agentScenarioInputs) {
    const result = await Effect.runPromise(
      normalizeCanvasChanges({ layout: scenario.layout, changes: scenario.changes }),
    );
    const doc = result.document;
    const cells = toX6Cells(doc);
    const byId = new Map(cells.filter((c) => c.shape !== "edge").map((c) => [c.id, box(c)]));

    // 组必须包含其子节点（toX6Cells 已是绝对坐标）
    const group = doc.elements.find((e) => e.kind === "group");
    if (group) {
      const g = byId.get(group.id)!;
      for (const child of doc.elements.filter((e) => e.parentId === group.id)) {
        const c = byId.get(child.id)!;
        expect(c.x, `${scenario.title}: 子节点 ${child.id} 超出组左`).toBeGreaterThanOrEqual(g.x);
        expect(c.x + c.width).toBeLessThanOrEqual(g.x + g.width);
        expect(c.y).toBeGreaterThanOrEqual(g.y);
        expect(c.y + c.height).toBeLessThanOrEqual(g.y + g.height);
      }
    }

    // 顶层节点（含组）互不重叠
    const top = doc.elements.filter((e) => !e.parentId).map((e) => byId.get(e.id)!);
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

    // 每条边连接已存在的节点（端口方向相反）
    for (const edge of doc.edges) {
      expect(byId.has(edge.source.cell), `${scenario.title}: 边 ${edge.id} 源不存在`).toBe(true);
      expect(byId.has(edge.target.cell), `${scenario.title}: 边 ${edge.id} 目标不存在`).toBe(true);
      const horizontal = scenario.layout !== "vertical";
      expect(edge.source.port).toBe(horizontal ? "right" : "bottom");
      expect(edge.target.port).toBe(horizontal ? "left" : "top");
    }
  }
});
