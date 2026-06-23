import { describe, it, expect } from "vitest";
import {
  runCommand,
  parseJsonl,
  parseJson,
  getUnderstandingId,
  getDomainId,
  getDeletedUnderstandingId,
  queryDbOne,
  queryDb,
} from "./helpers";

describe("Understanding 管理", () => {
  describe("understanding list", () => {
    it("列出所有活跃 Understanding", async () => {
      const { code, stdout } = await runCommand(["understanding", "list"]);
      expect(code).toBe(0);
      const understandings = parseJsonl(stdout);
      expect(understandings.length).toBeGreaterThan(0);
      for (const t of understandings) {
        expect(t).toMatchObject({
          id: expect.any(String),
          body: expect.any(String),
          domains: expect.any(Array),
        });
      }
    });

    it("按 Domain ID 过滤", async () => {
      const catId = getDomainId("React");
      expect(catId).toBeDefined();
      const { code, stdout } = await runCommand(["understanding", "list", "--domain-id", catId!]);
      expect(code).toBe(0);
      const understandings = parseJsonl(stdout);
      for (const id of understandings.map((t) => (t as { id: string }).id)) {
        const link = queryDbOne<{ c: number }>(
          `SELECT count(*) AS c FROM understanding_domains WHERE understanding_id = '${id}' AND domain_id = '${catId}'`,
        );
        expect(link?.c).toBe(1);
      }
    });

    it("按 Domain ID 过滤并包含后代 Domain", async () => {
      const parentId = getDomainId("Programming");
      expect(parentId).toBeDefined();
      const { code, stdout } = await runCommand([
        "understanding",
        "list",
        "--domain-id",
        parentId!,
        "--include-descendants",
      ]);
      expect(code).toBe(0);
      const understandings = parseJsonl(stdout);
      expect(understandings.length).toBeGreaterThan(0);
    });

    it("列出最近更新的 Understanding", async () => {
      const { code, stdout } = await runCommand(["understanding", "list", "--recent"]);
      expect(code).toBe(0);
      const understandings = parseJsonl(stdout);
      expect(understandings.length).toBeGreaterThan(0);
      expect(understandings.length).toBeLessThanOrEqual(20);
    });

    it("--recent 不能与 --domain-id 同时使用", async () => {
      const catId = getDomainId("React");
      const { code, stderr } = await runCommand([
        "understanding",
        "list",
        "--recent",
        "--domain-id",
        catId!,
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("VALIDATION_ERROR");
    });

    it("限制返回数量", async () => {
      const { code, stdout } = await runCommand(["understanding", "list", "--limit", "5"]);
      expect(code).toBe(0);
      expect(parseJsonl(stdout).length).toBe(5);
    });

    it("软删除的 Understanding 不会出现在列表中", async () => {
      const deletedId = getDeletedUnderstandingId("Soft Deleted Understanding A");
      expect(deletedId).toBeDefined();
      const { stdout } = await runCommand(["understanding", "list"]);
      const ids = parseJsonl(stdout).map((t) => (t as { id: string }).id);
      expect(ids).not.toContain(deletedId);
    });
  });

  describe("understanding get", () => {
    it("查看一条活跃 Understanding", async () => {
      const understandingId = getUnderstandingId("React Server Components");
      expect(understandingId).toBeDefined();
      const { code, stdout } = await runCommand(["understanding", "get", understandingId!]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as Record<string, unknown>;
      expect(data.id).toBe(understandingId);
      expect(data).toHaveProperty("contextCount");
      expect(data).toHaveProperty("referenceCount");
      expect(data).toHaveProperty("referencedByCount");
    });

    it("查看不存在的 Understanding", async () => {
      const { code, stderr } = await runCommand(["understanding", "get", "nonexistent-id-12345"]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });

    it("查看已软删除的 Understanding", async () => {
      const deletedId = getDeletedUnderstandingId("Soft Deleted Understanding A");
      expect(deletedId).toBeDefined();
      const { code, stderr } = await runCommand(["understanding", "get", deletedId!]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });

    it("附带 Context 列表", async () => {
      const understandingId = getUnderstandingId("React Server Components");
      expect(understandingId).toBeDefined();
      const { code, stdout } = await runCommand([
        "understanding",
        "get",
        understandingId!,
        "--include-contexts",
      ]);
      expect(code).toBe(0);
      expect(Array.isArray((parseJson(stdout) as { contexts?: unknown[] }).contexts)).toBe(true);
    });

    it("附带引用列表", async () => {
      const understandingId = getUnderstandingId("React Server Components");
      expect(understandingId).toBeDefined();
      const { code, stdout } = await runCommand([
        "understanding",
        "get",
        understandingId!,
        "--include-references",
      ]);
      expect(code).toBe(0);
      expect(Array.isArray((parseJson(stdout) as { references?: unknown[] }).references)).toBe(
        true,
      );
    });

    it("附带被引用列表", async () => {
      const understandingId = getUnderstandingId("Star Center");
      expect(understandingId).toBeDefined();
      const { code, stdout } = await runCommand([
        "understanding",
        "get",
        understandingId!,
        "--include-referenced-bys",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { referencedBys?: unknown[] };
      expect(Array.isArray(data.referencedBys)).toBe(true);
      expect(data.referencedBys!.length).toBeGreaterThan(0);
    });

    it("同时附带 Context、引用和被引用", async () => {
      const understandingId = getUnderstandingId("React Server Components");
      expect(understandingId).toBeDefined();
      const { code, stdout } = await runCommand([
        "understanding",
        "get",
        understandingId!,
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

  describe("understanding create", () => {
    it("创建最简 Understanding", async () => {
      const { code, stdout } = await runCommand(["understanding", "create", "--yes"]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { title: unknown; body: string };
      expect(data.title).toBeNull();
      expect(data.body).toBe("");
    });

    it("创建完整的 Understanding", async () => {
      const catA = getDomainId("Programming");
      const catB = getDomainId("Design");
      const { code, stdout } = await runCommand([
        "understanding",
        "create",
        "--title",
        "Test Creation",
        "--body",
        "Test body",
        "--domain-id",
        `${catA},${catB}`,
        "--yes",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { title: string; body: string };
      expect(data.title).toBe("Test Creation");
      expect(data.body).toBe("Test body");
    });

    it("未加 --yes 时拒绝创建", async () => {
      const { code } = await runCommand(["understanding", "create"]);
      expect(code).toBe(3);
    });
  });

  describe("understanding update", () => {
    it("更新 Understanding 标题", async () => {
      const { stdout: createOut } = await runCommand([
        "understanding",
        "create",
        "--title",
        "Update Target",
        "--yes",
      ]);
      const understandingId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand([
        "understanding",
        "update",
        understandingId,
        "--title",
        "New Title",
        "--yes",
      ]);
      expect(code).toBe(0);
      expect((parseJson(stdout) as { title: string }).title).toBe("New Title");
    });

    it("更新正文并自动同步 wiki-link 连接", async () => {
      const targetId = getUnderstandingId("Star Center");
      expect(targetId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "understanding",
        "create",
        "--title",
        "Link Source",
        "--yes",
      ]);
      const understandingId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand([
        "understanding",
        "update",
        understandingId,
        "--body",
        `See [[Star Center#${targetId}]]`,
        "--yes",
      ]);
      expect(code).toBe(0);
      const conn = queryDbOne<{ c: number }>(
        `SELECT count(*) AS c FROM understanding_connections WHERE source_id = '${understandingId}' AND target_id = '${targetId}'`,
      );
      expect(conn?.c).toBe(1);
    });

    it("更新正文时清除旧连接", async () => {
      const targetId = getUnderstandingId("Star Center");
      expect(targetId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "understanding",
        "create",
        "--title",
        "Link Then Unlink",
        "--body",
        `See [[Star Center#${targetId}]]`,
        "--yes",
      ]);
      const understandingId = (parseJson(createOut) as { id: string }).id;
      const before = queryDbOne<{ c: number }>(
        `SELECT count(*) AS c FROM understanding_connections WHERE source_id = '${understandingId}'`,
      );
      expect(before!.c).toBe(1);
      const { code } = await runCommand([
        "understanding",
        "update",
        understandingId,
        "--body",
        "No more links",
        "--yes",
      ]);
      expect(code).toBe(0);
      const after = queryDbOne<{ c: number }>(
        `SELECT count(*) AS c FROM understanding_connections WHERE source_id = '${understandingId}'`,
      );
      expect(after!.c).toBe(0);
    });

    it("更新 Domain 关联", async () => {
      const catB = getDomainId("Backend");
      const catC = getDomainId("DevOps");
      expect(catB).toBeDefined();
      expect(catC).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "understanding",
        "create",
        "--title",
        "Domain Test",
        "--domain-id",
        getDomainId("Programming")!,
        "--yes",
      ]);
      const understandingId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand([
        "understanding",
        "update",
        understandingId,
        "--domain-id",
        `${catB},${catC}`,
        "--yes",
      ]);
      expect(code).toBe(0);
      const cats = queryDb<{ domain_id: string }>(
        `SELECT domain_id FROM understanding_domains WHERE understanding_id = '${understandingId}'`,
      );
      expect(cats.map((r) => r.domain_id)).toContain(catB);
      expect(cats.map((r) => r.domain_id)).toContain(catC);
    });

    it("更新不存在的 Understanding", async () => {
      const { code, stderr } = await runCommand([
        "understanding",
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

  describe("understanding delete", () => {
    it("软删除 Understanding", async () => {
      const { stdout: createOut } = await runCommand([
        "understanding",
        "create",
        "--title",
        "To Delete",
        "--yes",
      ]);
      const understandingId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand(["understanding", "delete", understandingId, "--yes"]);
      expect(code).toBe(0);
      const row = queryDbOne<{ deleted_at: string | null }>(
        `SELECT deleted_at FROM understandings WHERE id = '${understandingId}'`,
      );
      expect(row!.deleted_at).not.toBeNull();
    });

    it("删除后从 FTS 索引中移除", async () => {
      const { stdout: createOut } = await runCommand([
        "understanding",
        "create",
        "--title",
        "FTS Delete Test",
        "--body",
        "UNIQUE_KEYWORD_XYZ",
        "--yes",
      ]);
      const understandingId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand(["understanding", "delete", understandingId, "--yes"]);
      expect(code).toBe(0);
      const { stdout } = await runCommand(["search", "understandings", "UNIQUE_KEYWORD_XYZ"]);
      const ids = parseJsonl(stdout).map((r) => (r as { id: string }).id);
      expect(ids).not.toContain(understandingId);
    });

    it("删除不存在的 Understanding", async () => {
      const { code, stderr } = await runCommand([
        "understanding",
        "delete",
        "nonexistent-id-12345",
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });

    it("未加 --yes 时拒绝删除", async () => {
      const { stdout: createOut } = await runCommand([
        "understanding",
        "create",
        "--title",
        "No Delete",
        "--yes",
      ]);
      const understandingId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand(["understanding", "delete", understandingId]);
      expect(code).toBe(3);
    });
  });
});
