import { describe, it, expect } from "vitest";
import { runCommand, parseJson, countRows } from "./helpers";

describe("项目快照", () => {
  it("正常项目快照", async () => {
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as {
      categories: unknown[];
      recentThoughts: unknown[];
      stats: {
        totalThoughts: number;
        totalContexts: number;
        totalCategories: number;
        totalReferences: number;
      };
    };
    expect(Array.isArray(data.categories)).toBe(true);
    expect(Array.isArray(data.recentThoughts)).toBe(true);
    expect(data.stats.totalThoughts).toBeGreaterThanOrEqual(0);
    expect(data.stats.totalContexts).toBeGreaterThanOrEqual(0);
    expect(data.stats.totalCategories).toBeGreaterThanOrEqual(0);
    expect(data.stats.totalReferences).toBeGreaterThanOrEqual(0);
  });

  it("Category 的 Thought 计数", async () => {
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as {
      categories: Array<{ id: string; name: string; thoughtCount: number }>;
    };
    const cat = data.categories.find((c) => c.name === "React");
    if (cat) expect(cat.thoughtCount).toBeGreaterThanOrEqual(0);
  });

  it("统计仅计入活跃 Thought", async () => {
    const activeThoughts = countRows("thoughts WHERE deleted_at IS NULL");
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as { stats: { totalThoughts: number } };
    expect(data.stats.totalThoughts).toBe(activeThoughts);
  });

  it("统计仅计入活跃 Context", async () => {
    const activeContexts = countRows("contexts WHERE deleted_at IS NULL");
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as { stats: { totalContexts: number } };
    expect(data.stats.totalContexts).toBe(activeContexts);
  });

  it("统计计入全部 Category", async () => {
    const totalCategories = countRows("categories");
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as { stats: { totalCategories: number } };
    expect(data.stats.totalCategories).toBe(totalCategories);
  });

  it("recentThoughts 最多返回 10 条", async () => {
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as { recentThoughts: unknown[] };
    expect(data.recentThoughts.length).toBeLessThanOrEqual(10);
  });
});
