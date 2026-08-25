import { describe, expect, test } from "vitest";
import { typicalCanvasDocument, withUniqueCanvasIds } from "./canvas-story-fixtures";

describe("withUniqueCanvasIds", () => {
  test("所有元素 / 连线 id 全局唯一，且内部引用（parentId / 边端点）同步重映射", () => {
    const unique = withUniqueCanvasIds(typicalCanvasDocument);

    const elementIds = unique.elements.map((element) => element.id);
    expect(new Set(elementIds).size).toBe(elementIds.length);
    expect(elementIds).not.toContain("el-irrigation");

    const edgeIds = unique.edges.map((edge) => edge.id);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);

    // 组内子元素 parentId 仍指向重映射后的组 id
    const group = unique.elements.find((element) => element.kind === "group")!;
    const grouped = unique.elements.find((element) => element.parentId === group.id);
    expect(grouped).toBeDefined();

    // 边端点 cell 指向重映射后的元素 id
    for (const edge of unique.edges) {
      expect(unique.elements.some((element) => element.id === edge.source.cell)).toBe(true);
      expect(unique.elements.some((element) => element.id === edge.target.cell)).toBe(true);
    }
  });

  test("重复调用产出不同 id（每次挂载独立）", () => {
    const first = withUniqueCanvasIds(typicalCanvasDocument);
    const second = withUniqueCanvasIds(typicalCanvasDocument);
    expect(first.elements[0]!.id).not.toBe(second.elements[0]!.id);
  });
});
