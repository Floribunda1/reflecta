import { describe, it, expect } from "vitest";
import { runCommand, parseJsonl, parseJson, getCategoryId, queryDbOne, countRows } from "./helpers";

describe("Category 管理", () => {
  describe("category list", () => {
    it("列出所有 Category", async () => {
      const { code, stdout } = await runCommand(["category", "list"]);
      expect(code).toBe(0);
      const categories = parseJsonl(stdout);
      expect(categories.length).toBeGreaterThan(0);
      for (const c of categories) {
        expect(c).toMatchObject({ id: expect.any(String), name: expect.any(String) });
      }
    });

    it("列表同时包含根节点与叶子节点", async () => {
      const { code, stdout } = await runCommand(["category", "list"]);
      expect(code).toBe(0);
      const categories = parseJsonl(stdout) as Array<{ id: string; parentId: string | null }>;
      const hasRoot = categories.some((c) => c.parentId === null);
      const hasLeaf = categories.some((c) => !categories.some((p) => p.parentId === c.id));
      expect(hasRoot).toBe(true);
      expect(hasLeaf).toBe(true);
    });
  });

  describe("category get", () => {
    it("获取已存在的 Category", async () => {
      const catId = getCategoryId("Programming");
      expect(catId).toBeDefined();
      const { code, stdout } = await runCommand(["category", "get", catId!]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { id: string; name: string };
      expect(data.id).toBe(catId);
      expect(data.name).toBe("Programming");
    });

    it("获取不存在的 Category", async () => {
      const { code, stderr } = await runCommand(["category", "get", "nonexistent-id-12345"]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });
  });

  describe("category inspect", () => {
    it("检查包含 Thought 的 Category", async () => {
      const catId = getCategoryId("Programming");
      expect(catId).toBeDefined();
      const { code, stdout } = await runCommand(["category", "inspect", catId!]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as {
        category: unknown;
        categories: unknown[];
        thoughts: unknown[];
        page: { hasMore: boolean };
      };
      expect(data.category).toBeDefined();
      expect(Array.isArray(data.categories)).toBe(true);
      expect(Array.isArray(data.thoughts)).toBe(true);
      expect(data.page.hasMore).toBe(false);
    });

    it("检查时使用分页限制", async () => {
      const catId = getCategoryId("Programming");
      expect(catId).toBeDefined();
      const { code, stdout } = await runCommand(["category", "inspect", catId!, "--limit", "2"]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { thoughts: unknown[]; page: { hasMore: boolean } };
      expect(data.thoughts.length).toBeLessThanOrEqual(2);
    });

    it("检查不存在的 Category", async () => {
      const { code, stderr } = await runCommand(["category", "inspect", "nonexistent-id-12345"]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });
  });

  describe("category create", () => {
    it("创建根 Category", async () => {
      const { code, stdout } = await runCommand([
        "category",
        "create",
        "--name",
        "Test Root",
        "--yes",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { id: string; name: string; parentId: string | null };
      expect(data.name).toBe("Test Root");
      expect(data.parentId).toBeNull();
    });

    it("创建子 Category", async () => {
      const parentId = getCategoryId("Programming");
      expect(parentId).toBeDefined();
      const { code, stdout } = await runCommand([
        "category",
        "create",
        "--name",
        "Test Child",
        "--parent-id",
        parentId!,
        "--yes",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { id: string; name: string; parentId: string };
      expect(data.name).toBe("Test Child");
      expect(data.parentId).toBe(parentId);
    });

    it("缺少必填参数 --name", async () => {
      const { code, stderr } = await runCommand(["category", "create", "--yes"]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("VALIDATION_ERROR");
    });

    it("未加 --yes 时拒绝创建", async () => {
      const { code } = await runCommand(["category", "create", "--name", "X"]);
      expect(code).toBe(3);
    });
  });

  describe("category update", () => {
    it("重命名 Category", async () => {
      const { stdout: createOut } = await runCommand([
        "category",
        "create",
        "--name",
        "Rename Me",
        "--yes",
      ]);
      const catId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand([
        "category",
        "update",
        catId,
        "--name",
        "Renamed",
        "--yes",
      ]);
      expect(code).toBe(0);
      expect((parseJson(stdout) as { name: string }).name).toBe("Renamed");
    });

    it("移动 Category 到新的父节点", async () => {
      const parentId = getCategoryId("Design");
      expect(parentId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "category",
        "create",
        "--name",
        "Move Me",
        "--yes",
      ]);
      const catId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand([
        "category",
        "update",
        catId,
        "--parent-id",
        parentId!,
        "--yes",
      ]);
      expect(code).toBe(0);
      expect((parseJson(stdout) as { parentId: string }).parentId).toBe(parentId);
    });

    it("更新不存在的 Category", async () => {
      const { code, stderr } = await runCommand([
        "category",
        "update",
        "nonexistent-id-12345",
        "--name",
        "X",
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });
  });

  describe("category delete", () => {
    it("不使用级联删除 Category", async () => {
      const { stdout: createOut } = await runCommand([
        "category",
        "create",
        "--name",
        "Delete Me",
        "--yes",
      ]);
      const catId = (parseJson(createOut) as { id: string }).id;
      const thoughtCountBefore = countRows("thoughts");
      const { code } = await runCommand(["category", "delete", catId, "--yes"]);
      expect(code).toBe(0);
      const catRow = queryDbOne<{ c: number }>(
        `SELECT count(*) AS c FROM categories WHERE id = '${catId}'`,
      );
      expect(catRow!.c).toBe(0);
      expect(countRows("thoughts")).toBe(thoughtCountBefore);
    });

    it("使用级联删除 Category", async () => {
      const { stdout: catOut } = await runCommand([
        "category",
        "create",
        "--name",
        "Cascade Cat",
        "--yes",
      ]);
      const catId = (parseJson(catOut) as { id: string }).id;
      const { stdout: thOut } = await runCommand([
        "thought",
        "create",
        "--type",
        "idea",
        "--title",
        "Cascade Thought",
        "--category-id",
        catId,
        "--yes",
      ]);
      const thoughtId = (parseJson(thOut) as { id: string }).id;
      const { code } = await runCommand(["category", "delete", catId, "--yes", "--cascade"]);
      expect(code).toBe(0);
      const thRow = queryDbOne<{ c: number }>(
        `SELECT count(*) AS c FROM thoughts WHERE id = '${thoughtId}'`,
      );
      expect(thRow!.c).toBe(0);
    });

    it("删除不存在的 Category", async () => {
      const { code, stderr } = await runCommand([
        "category",
        "delete",
        "nonexistent-id-12345",
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });
  });
});
