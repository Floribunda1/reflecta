import { describe, it, expect } from "vitest";
import {
  runCommand,
  parseJsonl,
  parseJson,
  getUnderstandingId,
  getDomainId,
  getDeletedUnderstandingId,
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
      const understandings = parseJsonl(stdout) as Array<{
        domains: Array<{ id: string }>;
      }>;
      for (const understanding of understandings) {
        expect(understanding.domains.map((domain) => domain.id)).toContain(catId);
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

    it("可按 Understanding 分组附带 Context", async () => {
      const { code, stdout } = await runCommand([
        "understanding",
        "list",
        "--include-contexts",
        "--limit",
        "5",
        "--format",
        "json",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as {
        understandings?: Array<{ id: string }>;
        contextsByUnderstandingId?: Record<string, unknown[]>;
      };
      expect(Array.isArray(data.understandings)).toBe(true);
      expect(data.contextsByUnderstandingId).toBeDefined();
      expect(Object.keys(data.contextsByUnderstandingId ?? {}).length).toBeGreaterThan(0);
    });

    it("列表只显示当前可用的 Understanding", async () => {
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

    it("查看已删除的 Understanding 时返回未找到", async () => {
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

    it("附带关系列表", async () => {
      const understandingId = getUnderstandingId("React Server Components");
      expect(understandingId).toBeDefined();
      const { code, stdout } = await runCommand([
        "understanding",
        "get",
        understandingId!,
        "--include-relations",
      ]);
      expect(code).toBe(0);
      expect(Array.isArray((parseJson(stdout) as { relations?: unknown[] }).relations)).toBe(true);
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
        `See [[u:${targetId}]]`,
        "--yes",
      ]);
      expect(code).toBe(0);
      const detail = parseJson(
        (await runCommand(["understanding", "get", understandingId, "--include-relations"])).stdout,
      ) as { relations: Array<{ targetUnderstandingId: string | null }> };
      expect(detail.relations.map((relation) => relation.targetUnderstandingId)).toContain(
        targetId,
      );
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
        `See [[u:${targetId}]]`,
        "--yes",
      ]);
      const understandingId = (parseJson(createOut) as { id: string }).id;
      const before = parseJson(
        (await runCommand(["understanding", "get", understandingId, "--include-relations"])).stdout,
      ) as { relations: unknown[] };
      expect(before.relations).toHaveLength(1);
      const { code } = await runCommand([
        "understanding",
        "update",
        understandingId,
        "--body",
        "No more links",
        "--yes",
      ]);
      expect(code).toBe(0);
      const after = parseJson(
        (await runCommand(["understanding", "get", understandingId, "--include-relations"])).stdout,
      ) as { relations: unknown[] };
      expect(after.relations).toEqual([]);
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
      const { code, stdout } = await runCommand([
        "understanding",
        "update",
        understandingId,
        "--domain-id",
        `${catB},${catC}`,
        "--yes",
      ]);
      expect(code).toBe(0);
      const domains = (parseJson(stdout) as { domains: Array<{ id: string }> }).domains.map(
        (domain) => domain.id,
      );
      expect(domains).toEqual(expect.arrayContaining([catB!, catC!]));
      expect(domains).toHaveLength(2);
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
    it("删除 Understanding 后公开查询返回最新状态", async () => {
      const { stdout: createOut } = await runCommand([
        "understanding",
        "create",
        "--title",
        "To Delete",
        "--body",
        "DELETE_UNDERSTANDING_PUBLIC_CHECK",
        "--yes",
      ]);
      const understandingId = (parseJson(createOut) as { id: string }).id;
      await runCommand([
        "context",
        "create",
        "--understanding-id",
        understandingId,
        "--medium",
        "experience",
        "--content",
        "DELETE_CHILD_CONTEXT_PUBLIC_CHECK",
        "--yes",
      ]);
      const { code } = await runCommand(["understanding", "delete", understandingId, "--yes"]);
      expect(code).toBe(0);
      const getResult = await runCommand(["understanding", "get", understandingId]);
      expect(getResult.code).toBe(1);
      expect(JSON.parse(getResult.stderr).code).toBe("NOT_FOUND");
      const ids = (
        parseJsonl((await runCommand(["understanding", "list"])).stdout) as Array<{ id: string }>
      ).map((understanding) => understanding.id);
      expect(ids).not.toContain(understandingId);
      for (const query of [
        "DELETE_UNDERSTANDING_PUBLIC_CHECK",
        "DELETE_CHILD_CONTEXT_PUBLIC_CHECK",
      ]) {
        const search = await runCommand(["search", query, "--format", "json"]);
        const hits = (
          parseJson(search.stdout) as {
            hits: Array<{
              understanding?: { id: string };
              context?: { understandingId: string };
            }>;
          }
        ).hits;
        expect(
          hits.flatMap((hit) => [hit.understanding?.id, hit.context?.understandingId]),
        ).not.toContain(understandingId);
      }
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
