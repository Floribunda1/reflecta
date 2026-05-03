import { describe, it, expect } from "vitest";
import {
  runCommand,
  parseJsonl,
  parseJson,
  getThoughtId,
  getCategoryId,
  getDeletedThoughtId,
  queryDbOne,
  queryDb,
} from "./helpers";

describe("Thought 管理", () => {
  describe("thought list", () => {
    it("列出所有活跃 Thought", async () => {
      const { code, stdout } = await runCommand(["thought", "list"]);
      expect(code).toBe(0);
      const thoughts = parseJsonl(stdout);
      expect(thoughts.length).toBeGreaterThan(0);
      for (const t of thoughts) {
        expect(t).toMatchObject({
          id: expect.any(String),
          type: expect.any(String),
          body: expect.any(String),
          categories: expect.any(Array),
        });
      }
    });

    it("按类型 idea 过滤", async () => {
      const { code, stdout } = await runCommand(["thought", "list", "--type", "idea"]);
      expect(code).toBe(0);
      const thoughts = parseJsonl(stdout);
      expect(thoughts.length).toBeGreaterThan(0);
      for (const t of thoughts) expect((t as { type: string }).type).toBe("idea");
    });

    it("按类型 insight 过滤", async () => {
      const { code, stdout } = await runCommand(["thought", "list", "--type", "insight"]);
      expect(code).toBe(0);
      const thoughts = parseJsonl(stdout);
      expect(thoughts.length).toBeGreaterThan(0);
      for (const t of thoughts) expect((t as { type: string }).type).toBe("insight");
    });

    it("按 Category ID 过滤", async () => {
      const catId = getCategoryId("React");
      expect(catId).toBeDefined();
      const { code, stdout } = await runCommand(["thought", "list", "--category-id", catId!]);
      expect(code).toBe(0);
      const thoughts = parseJsonl(stdout);
      for (const id of thoughts.map((t) => (t as { id: string }).id)) {
        const link = queryDbOne<{ c: number }>(
          `SELECT count(*) AS c FROM thought_categories WHERE thought_id = '${id}' AND category_id = '${catId}'`,
        );
        expect(link?.c).toBe(1);
      }
    });

    it("按 Category ID 过滤并包含后代 Category", async () => {
      const parentId = getCategoryId("Programming");
      expect(parentId).toBeDefined();
      const { code, stdout } = await runCommand([
        "thought",
        "list",
        "--category-id",
        parentId!,
        "--include-descendants",
      ]);
      expect(code).toBe(0);
      const thoughts = parseJsonl(stdout);
      expect(thoughts.length).toBeGreaterThan(0);
    });

    it("列出最近更新的 Thought", async () => {
      const { code, stdout } = await runCommand(["thought", "list", "--recent"]);
      expect(code).toBe(0);
      const thoughts = parseJsonl(stdout);
      expect(thoughts.length).toBeGreaterThan(0);
      expect(thoughts.length).toBeLessThanOrEqual(20);
    });

    it("--recent 不能与 --type 同时使用", async () => {
      const { code, stderr } = await runCommand(["thought", "list", "--recent", "--type", "idea"]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("VALIDATION_ERROR");
    });

    it("--recent 不能与 --category-id 同时使用", async () => {
      const catId = getCategoryId("React");
      const { code, stderr } = await runCommand([
        "thought",
        "list",
        "--recent",
        "--category-id",
        catId!,
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("VALIDATION_ERROR");
    });

    it("限制返回数量", async () => {
      const { code, stdout } = await runCommand(["thought", "list", "--limit", "5"]);
      expect(code).toBe(0);
      expect(parseJsonl(stdout).length).toBe(5);
    });

    it("软删除的 Thought 不会出现在列表中", async () => {
      const deletedId = getDeletedThoughtId("Soft Deleted Thought A");
      expect(deletedId).toBeDefined();
      const { stdout } = await runCommand(["thought", "list"]);
      const ids = parseJsonl(stdout).map((t) => (t as { id: string }).id);
      expect(ids).not.toContain(deletedId);
    });
  });

  describe("thought get", () => {
    it("查看一条活跃 Thought", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { code, stdout } = await runCommand(["thought", "get", thoughtId!]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as Record<string, unknown>;
      expect(data.id).toBe(thoughtId);
      expect(data).toHaveProperty("contextCount");
      expect(data).toHaveProperty("referenceCount");
      expect(data).toHaveProperty("referencedByCount");
    });

    it("查看不存在的 Thought", async () => {
      const { code, stderr } = await runCommand(["thought", "get", "nonexistent-id-12345"]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });

    it("查看已软删除的 Thought", async () => {
      const deletedId = getDeletedThoughtId("Soft Deleted Thought A");
      expect(deletedId).toBeDefined();
      const { code, stderr } = await runCommand(["thought", "get", deletedId!]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });

    it("附带 Context 列表", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { code, stdout } = await runCommand([
        "thought",
        "get",
        thoughtId!,
        "--include-contexts",
      ]);
      expect(code).toBe(0);
      expect(Array.isArray((parseJson(stdout) as { contexts?: unknown[] }).contexts)).toBe(true);
    });

    it("附带引用列表", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { code, stdout } = await runCommand([
        "thought",
        "get",
        thoughtId!,
        "--include-references",
      ]);
      expect(code).toBe(0);
      expect(Array.isArray((parseJson(stdout) as { references?: unknown[] }).references)).toBe(
        true,
      );
    });

    it("附带被引用列表", async () => {
      const thoughtId = getThoughtId("Star Center");
      expect(thoughtId).toBeDefined();
      const { code, stdout } = await runCommand([
        "thought",
        "get",
        thoughtId!,
        "--include-referenced-bys",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { referencedBys?: unknown[] };
      expect(Array.isArray(data.referencedBys)).toBe(true);
      expect(data.referencedBys!.length).toBeGreaterThan(0);
    });

    it("同时附带 Context、引用和被引用", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { code, stdout } = await runCommand([
        "thought",
        "get",
        thoughtId!,
        "--include-contexts",
        "--include-references",
        "--include-referenced-bys",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as {
        contexts?: unknown[];
        references?: unknown[];
        referencedBys?: unknown[];
      };
      expect(Array.isArray(data.contexts)).toBe(true);
      expect(Array.isArray(data.references)).toBe(true);
      expect(Array.isArray(data.referencedBys)).toBe(true);
    });
  });

  describe("thought create", () => {
    it("创建最简 Thought", async () => {
      const { code, stdout } = await runCommand(["thought", "create", "--type", "idea", "--yes"]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { type: string; title: unknown; body: string };
      expect(data.type).toBe("idea");
      expect(data.title).toBeNull();
      expect(data.body).toBe("");
    });

    it("创建完整的 Thought", async () => {
      const catA = getCategoryId("Programming");
      const catB = getCategoryId("Design");
      const { code, stdout } = await runCommand([
        "thought",
        "create",
        "--type",
        "insight",
        "--title",
        "Test Creation",
        "--body",
        "Test body",
        "--category-id",
        `${catA},${catB}`,
        "--yes",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { title: string; body: string };
      expect(data.title).toBe("Test Creation");
      expect(data.body).toBe("Test body");
    });

    it("缺少必填参数 --type", async () => {
      const { code, stderr } = await runCommand(["thought", "create", "--yes"]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("VALIDATION_ERROR");
    });

    it("未加 --yes 时拒绝创建", async () => {
      const { code } = await runCommand(["thought", "create", "--type", "idea"]);
      expect(code).toBe(3);
    });
  });

  describe("thought update", () => {
    it("更新 Thought 标题", async () => {
      const { stdout: createOut } = await runCommand([
        "thought",
        "create",
        "--type",
        "idea",
        "--title",
        "Update Target",
        "--yes",
      ]);
      const thoughtId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand([
        "thought",
        "update",
        thoughtId,
        "--title",
        "New Title",
        "--yes",
      ]);
      expect(code).toBe(0);
      expect((parseJson(stdout) as { title: string }).title).toBe("New Title");
    });

    it("更新正文并自动同步 wiki-link 连接", async () => {
      const targetId = getThoughtId("Star Center");
      expect(targetId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "thought",
        "create",
        "--type",
        "idea",
        "--title",
        "Link Source",
        "--yes",
      ]);
      const thoughtId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand([
        "thought",
        "update",
        thoughtId,
        "--body",
        `See [[Star Center#${targetId}]]`,
        "--yes",
      ]);
      expect(code).toBe(0);
      const conn = queryDbOne<{ c: number }>(
        `SELECT count(*) AS c FROM thought_connections WHERE source_id = '${thoughtId}' AND target_id = '${targetId}'`,
      );
      expect(conn?.c).toBe(1);
    });

    it("更新正文时清除旧连接", async () => {
      const targetId = getThoughtId("Star Center");
      expect(targetId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "thought",
        "create",
        "--type",
        "idea",
        "--title",
        "Link Then Unlink",
        "--body",
        `See [[Star Center#${targetId}]]`,
        "--yes",
      ]);
      const thoughtId = (parseJson(createOut) as { id: string }).id;
      const before = queryDbOne<{ c: number }>(
        `SELECT count(*) AS c FROM thought_connections WHERE source_id = '${thoughtId}'`,
      );
      expect(before!.c).toBe(1);
      const { code } = await runCommand([
        "thought",
        "update",
        thoughtId,
        "--body",
        "No more links",
        "--yes",
      ]);
      expect(code).toBe(0);
      const after = queryDbOne<{ c: number }>(
        `SELECT count(*) AS c FROM thought_connections WHERE source_id = '${thoughtId}'`,
      );
      expect(after!.c).toBe(0);
    });

    it("更新 Category 关联", async () => {
      const catB = getCategoryId("Backend");
      const catC = getCategoryId("DevOps");
      expect(catB).toBeDefined();
      expect(catC).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "thought",
        "create",
        "--type",
        "idea",
        "--title",
        "Category Test",
        "--category-id",
        getCategoryId("Programming")!,
        "--yes",
      ]);
      const thoughtId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand([
        "thought",
        "update",
        thoughtId,
        "--category-id",
        `${catB},${catC}`,
        "--yes",
      ]);
      expect(code).toBe(0);
      const cats = queryDb<{ category_id: string }>(
        `SELECT category_id FROM thought_categories WHERE thought_id = '${thoughtId}'`,
      );
      expect(cats.map((r) => r.category_id)).toContain(catB);
      expect(cats.map((r) => r.category_id)).toContain(catC);
    });

    it("更新不存在的 Thought", async () => {
      const { code, stderr } = await runCommand([
        "thought",
        "update",
        "nonexistent-id-12345",
        "--title",
        "X",
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });
  });

  describe("thought delete", () => {
    it("软删除 Thought", async () => {
      const { stdout: createOut } = await runCommand([
        "thought",
        "create",
        "--type",
        "idea",
        "--title",
        "To Delete",
        "--yes",
      ]);
      const thoughtId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand(["thought", "delete", thoughtId, "--yes"]);
      expect(code).toBe(0);
      const row = queryDbOne<{ deleted_at: string | null }>(
        `SELECT deleted_at FROM thoughts WHERE id = '${thoughtId}'`,
      );
      expect(row!.deleted_at).not.toBeNull();
    });

    it("删除后从 FTS 索引中移除", async () => {
      const { stdout: createOut } = await runCommand([
        "thought",
        "create",
        "--type",
        "insight",
        "--title",
        "FTS Delete Test",
        "--body",
        "UNIQUE_KEYWORD_XYZ",
        "--yes",
      ]);
      const thoughtId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand(["thought", "delete", thoughtId, "--yes"]);
      expect(code).toBe(0);
      const { stdout } = await runCommand(["search", "thoughts", "UNIQUE_KEYWORD_XYZ"]);
      const ids = parseJsonl(stdout).map((r) => (r as { id: string }).id);
      expect(ids).not.toContain(thoughtId);
    });

    it("删除不存在的 Thought", async () => {
      const { code, stderr } = await runCommand([
        "thought",
        "delete",
        "nonexistent-id-12345",
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });

    it("未加 --yes 时拒绝删除", async () => {
      const { stdout: createOut } = await runCommand([
        "thought",
        "create",
        "--type",
        "idea",
        "--title",
        "No Delete",
        "--yes",
      ]);
      const thoughtId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand(["thought", "delete", thoughtId]);
      expect(code).toBe(3);
    });
  });
});
