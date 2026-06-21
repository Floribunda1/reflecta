import { describe, it, expect } from "vitest";
import { runCommand, parseJson, getThoughtId } from "./helpers";

describe("图遍历", () => {
  describe("graph neighborhood", () => {
    it("深度为 1 的邻域", async () => {
      const seedId = getThoughtId("Star Center");
      expect(seedId).toBeDefined();
      const { code, stdout } = await runCommand(["graph", "neighborhood", "--thought-id", seedId!]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { seed: string; nodes: unknown[]; edges: unknown[] };
      expect(data.seed).toBe(seedId);
      expect(data.nodes.length).toBeGreaterThan(1);
      expect(Array.isArray(data.edges)).toBe(true);
    });

    it("深度为 2 的邻域", async () => {
      const seedId = getThoughtId("Long Path Start");
      expect(seedId).toBeDefined();
      const { code, stdout } = await runCommand([
        "graph",
        "neighborhood",
        "--thought-id",
        seedId!,
        "--depth",
        "2",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { nodes: Array<{ id: string }> };
      const nodeIds = data.nodes.map((n) => n.id);
      const path2Id = getThoughtId("Long Path 2");
      expect(nodeIds).toContain(path2Id);
    });

    it("孤立 Thought 的邻域", async () => {
      const { stdout: createOut } = await runCommand([
        "thought",
        "create",
        "--title",
        "Isolated Node",
        "--yes",
      ]);
      const seedId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand(["graph", "neighborhood", "--thought-id", seedId]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { nodes: unknown[]; edges: unknown[] };
      expect(data.nodes.length).toBe(1);
      expect(data.edges.length).toBe(0);
    });

    it("邻域查询不存在的 Thought", async () => {
      const { code, stderr } = await runCommand([
        "graph",
        "neighborhood",
        "--thought-id",
        "nonexistent-id-12345",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });

    it("邻域分页", async () => {
      const seedId = getThoughtId("Star Center");
      expect(seedId).toBeDefined();
      const { code, stdout } = await runCommand([
        "graph",
        "neighborhood",
        "--thought-id",
        seedId!,
        "--limit",
        "2",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { nodes: unknown[]; page: { hasMore: boolean } };
      expect(data.nodes.length).toBeLessThanOrEqual(2);
    });
  });

  describe("graph path", () => {
    it("存在直接路径", async () => {
      const fromId = getThoughtId("Star Leaf 1");
      const toId = getThoughtId("Star Center");
      expect(fromId).toBeDefined();
      expect(toId).toBeDefined();
      const { code, stdout } = await runCommand([
        "graph",
        "path",
        "--from",
        fromId!,
        "--to",
        toId!,
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { paths: Array<{ nodes: string[] }> };
      expect(data.paths.length).toBeGreaterThan(0);
    });

    it("存在多跳路径", async () => {
      const fromId = getThoughtId("Long Path Start");
      const toId = getThoughtId("Long Path 3");
      expect(fromId).toBeDefined();
      expect(toId).toBeDefined();
      const { code, stdout } = await runCommand([
        "graph",
        "path",
        "--from",
        fromId!,
        "--to",
        toId!,
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { paths: Array<{ nodes: string[] }> };
      expect(data.paths.length).toBeGreaterThan(0);
    });

    it("不存在路径", async () => {
      const fromId = getThoughtId("Star Center");
      const toId = getThoughtId("Unconnected Node");
      expect(fromId).toBeDefined();
      expect(toId).toBeDefined();
      const { code, stdout } = await runCommand([
        "graph",
        "path",
        "--from",
        fromId!,
        "--to",
        toId!,
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { paths: unknown[] };
      expect(data.paths.length).toBe(0);
    });

    it("起点与终点为同一节点", async () => {
      const seedId = getThoughtId("Star Center");
      expect(seedId).toBeDefined();
      const { code, stdout } = await runCommand([
        "graph",
        "path",
        "--from",
        seedId!,
        "--to",
        seedId!,
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { paths: Array<{ nodes: string[]; edges: unknown[] }> };
      expect(data.paths.length).toBe(1);
      expect(data.paths[0]!.nodes.length).toBe(1);
      expect(data.paths[0]!.edges.length).toBe(0);
    });

    it("缺少必填参数 --from", async () => {
      const toId = getThoughtId("Star Center");
      const { code, stderr } = await runCommand(["graph", "path", "--to", toId!]);
      expect(code).toBe(2);
      expect(JSON.parse(stderr).code).toBe("VALIDATION_ERROR");
    });
  });
});
