import { describe, expect, it } from "vitest";
import { getUnderstandingId, parseJson, runCommand } from "./helpers";

describe("graph", () => {
  it("返回指定 Understanding 的关联图", async () => {
    const seedId = getUnderstandingId("Star Center");
    expect(seedId).toBeDefined();

    const { code, stdout } = await runCommand(["graph", seedId!, "--depth", "1"]);

    expect(code).toBe(0);
    const data = parseJson(stdout) as { seed: string; nodes: unknown[]; edges: unknown[] };
    expect(data.seed).toBe(seedId);
    expect(data.nodes.length).toBeGreaterThan(1);
    expect(Array.isArray(data.edges)).toBe(true);
  });

  it("可附带 Context", async () => {
    const seedId = getUnderstandingId("React Server Components");
    expect(seedId).toBeDefined();

    const { code, stdout } = await runCommand([
      "graph",
      seedId!,
      "--depth",
      "0",
      "--include-context",
      "--format",
      "json",
    ]);

    expect(code).toBe(0);
    const data = parseJson(stdout) as { nodes: unknown[]; contexts?: unknown[] };
    expect(data.nodes.length).toBe(1);
    expect(Array.isArray(data.contexts)).toBe(true);
  });
});
