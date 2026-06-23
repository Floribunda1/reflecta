import { describe, it, expect } from "vitest";
import { runCommand, parseJson, countRows } from "./helpers";

describe("项目快照", () => {
  it("正常项目快照", async () => {
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as {
      domains: unknown[];
      recentUnderstandings: unknown[];
      stats: {
        totalUnderstandings: number;
        totalContexts: number;
        totalDomains: number;
        totalReferences: number;
      };
    };
    expect(Array.isArray(data.domains)).toBe(true);
    expect(Array.isArray(data.recentUnderstandings)).toBe(true);
    expect(data.stats.totalUnderstandings).toBeGreaterThanOrEqual(0);
    expect(data.stats.totalContexts).toBeGreaterThanOrEqual(0);
    expect(data.stats.totalDomains).toBeGreaterThanOrEqual(0);
    expect(data.stats.totalReferences).toBeGreaterThanOrEqual(0);
  });

  it("Domain 的 Understanding 计数", async () => {
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as {
      domains: Array<{ id: string; name: string; understandingCount: number }>;
    };
    const cat = data.domains.find((c) => c.name === "React");
    if (cat) expect(cat.understandingCount).toBeGreaterThanOrEqual(0);
  });

  it("统计仅计入活跃 Understanding", async () => {
    const activeUnderstandings = countRows("understandings WHERE deleted_at IS NULL");
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as { stats: { totalUnderstandings: number } };
    expect(data.stats.totalUnderstandings).toBe(activeUnderstandings);
  });

  it("统计仅计入活跃 Context", async () => {
    const activeContexts = countRows("contexts WHERE deleted_at IS NULL");
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as { stats: { totalContexts: number } };
    expect(data.stats.totalContexts).toBe(activeContexts);
  });

  it("统计计入全部 Domain", async () => {
    const totalDomains = countRows("domains");
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as { stats: { totalDomains: number } };
    expect(data.stats.totalDomains).toBe(totalDomains);
  });

  it("recentUnderstandings 最多返回 10 条", async () => {
    const { code, stdout } = await runCommand(["snapshot", "project"]);
    expect(code).toBe(0);
    const data = parseJson(stdout) as { recentUnderstandings: unknown[] };
    expect(data.recentUnderstandings.length).toBeLessThanOrEqual(10);
  });
});
