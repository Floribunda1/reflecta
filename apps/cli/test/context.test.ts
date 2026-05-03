import { describe, it, expect } from "vitest";
import {
  runCommand,
  parseJsonl,
  parseJson,
  getThoughtId,
  getContextId,
  queryDbOne,
} from "./helpers";

describe("Context 管理", () => {
  describe("context list", () => {
    it("列出某 Thought 下的所有活跃 Context", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { code, stdout } = await runCommand(["context", "list", "--thought-id", thoughtId!]);
      expect(code).toBe(0);
      const contexts = parseJsonl(stdout);
      expect(contexts.length).toBeGreaterThan(0);
      for (const c of contexts) {
        expect(c).toMatchObject({
          id: expect.any(String),
          thoughtId,
          sourceType: expect.any(String),
        });
      }
    });

    it("Thought 下没有任何 Context", async () => {
      // Create a fresh thought with no contexts to guarantee isolation
      const { stdout: createOut } = await runCommand([
        "thought",
        "create",
        "--type",
        "idea",
        "--title",
        "No Contexts",
        "--yes",
      ]);
      const thoughtId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand(["context", "list", "--thought-id", thoughtId]);
      expect(code).toBe(0);
      expect(stdout.trim()).toBe("");
    });

    it("缺少必填参数 --thought-id", async () => {
      const { code, stderr } = await runCommand(["context", "list"]);
      expect(code).toBe(2);
      expect(JSON.parse(stderr).code).toBe("VALIDATION_ERROR");
    });
  });

  describe("context get", () => {
    it("查看一条活跃 Context", async () => {
      const ctxId = getContextId("github.com/vercel/next.js");
      if (!ctxId) return;
      const { code, stdout } = await runCommand(["context", "get", ctxId]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as Record<string, unknown>;
      expect(data.id).toBe(ctxId);
    });

    it("查看不存在的 Context", async () => {
      const { code, stderr } = await runCommand(["context", "get", "nonexistent-id-12345"]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });
  });

  describe("context create", () => {
    it("创建最简 Context", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { code, stdout } = await runCommand([
        "context",
        "create",
        "--thought-id",
        thoughtId!,
        "--source-type",
        "code",
        "--yes",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as {
        thoughtId: string;
        sourceType: string;
        sourceName: unknown;
        content: string;
      };
      expect(data.thoughtId).toBe(thoughtId);
      expect(data.sourceType).toBe("code");
      expect(data.sourceName).toBeNull();
      expect(data.content).toBe("");
    });

    it("创建完整的 Context", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { code, stdout } = await runCommand([
        "context",
        "create",
        "--thought-id",
        thoughtId!,
        "--source-type",
        "article",
        "--source-name",
        "Blog Post",
        "--content",
        "Important note",
        "--yes",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { sourceName: string; content: string };
      expect(data.sourceName).toBe("Blog Post");
      expect(data.content).toBe("Important note");
    });

    it("缺少必填参数 --thought-id", async () => {
      const { code, stderr } = await runCommand([
        "context",
        "create",
        "--source-type",
        "code",
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("VALIDATION_ERROR");
    });

    it("缺少必填参数 --source-type", async () => {
      const thoughtId = getThoughtId("React Server Components");
      const { code, stderr } = await runCommand([
        "context",
        "create",
        "--thought-id",
        thoughtId!,
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("VALIDATION_ERROR");
    });

    it("未加 --yes 时拒绝创建", async () => {
      const thoughtId = getThoughtId("React Server Components");
      const { code } = await runCommand([
        "context",
        "create",
        "--thought-id",
        thoughtId!,
        "--source-type",
        "code",
      ]);
      expect(code).toBe(3);
    });
  });

  describe("context update", () => {
    it("更新 Context 内容", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "context",
        "create",
        "--thought-id",
        thoughtId!,
        "--source-type",
        "note",
        "--yes",
      ]);
      const ctxId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand([
        "context",
        "update",
        ctxId,
        "--content",
        "Updated content",
        "--yes",
      ]);
      expect(code).toBe(0);
      expect((parseJson(stdout) as { content: string }).content).toBe("Updated content");
    });

    it("更新 Context 来源名称", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "context",
        "create",
        "--thought-id",
        thoughtId!,
        "--source-type",
        "note",
        "--yes",
      ]);
      const ctxId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand([
        "context",
        "update",
        ctxId,
        "--source-name",
        "New Source",
        "--yes",
      ]);
      expect(code).toBe(0);
      expect((parseJson(stdout) as { sourceName: string }).sourceName).toBe("New Source");
    });

    it("更新不存在的 Context", async () => {
      const { code, stderr } = await runCommand([
        "context",
        "update",
        "nonexistent-id-12345",
        "--content",
        "X",
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });

    it("未加 --yes 时拒绝更新", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "context",
        "create",
        "--thought-id",
        thoughtId!,
        "--source-type",
        "note",
        "--yes",
      ]);
      const ctxId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand(["context", "update", ctxId, "--content", "X"]);
      expect(code).toBe(3);
    });
  });

  describe("context delete", () => {
    it("软删除 Context", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "context",
        "create",
        "--thought-id",
        thoughtId!,
        "--source-type",
        "note",
        "--yes",
      ]);
      const ctxId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand(["context", "delete", ctxId, "--yes"]);
      expect(code).toBe(0);
      const row = queryDbOne<{ deleted_at: string | null }>(
        `SELECT deleted_at FROM contexts WHERE id = '${ctxId}'`,
      );
      expect(row!.deleted_at).not.toBeNull();
    });

    it("删除不存在的 Context", async () => {
      const { code, stderr } = await runCommand([
        "context",
        "delete",
        "nonexistent-id-12345",
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });

    it("未加 --yes 时拒绝删除", async () => {
      const thoughtId = getThoughtId("React Server Components");
      expect(thoughtId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "context",
        "create",
        "--thought-id",
        thoughtId!,
        "--source-type",
        "note",
        "--yes",
      ]);
      const ctxId = (parseJson(createOut) as { id: string }).id;
      const { code } = await runCommand(["context", "delete", ctxId]);
      expect(code).toBe(3);
    });
  });
});
