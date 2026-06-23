import { describe, it, expect } from "vitest";
import { runCommand, parseJsonl, parseJson } from "./helpers";

describe("全文检索", () => {
  describe("search", () => {
    it("返回混合的 Understanding 与 Context 命中", async () => {
      const { code, stdout } = await runCommand(["search", "React", "--format", "json"]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { hits?: Array<{ type: string }> };
      expect(Array.isArray(data.hits)).toBe(true);
      expect(data.hits!.length).toBeGreaterThan(0);
      expect(data.hits!.every((hit) => ["understanding", "context"].includes(hit.type))).toBe(true);
    });

    it("Context 命中包含所属 Understanding ID", async () => {
      const { code, stdout } = await runCommand(["search", "Dockerfile", "--format", "json"]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as {
        hits?: Array<{ type: string; understandingId?: string }>;
      };
      const contextHit = data.hits?.find((hit) => hit.type === "context");
      expect(contextHit?.understandingId).toEqual(expect.any(String));
    });
  });

  describe("search understandings", () => {
    it("按标题匹配 Understanding", async () => {
      const { code, stdout } = await runCommand(["search", "understandings", "React"]);
      expect(code).toBe(0);
      const results = parseJsonl(stdout);
      expect(results.length).toBeGreaterThan(0);
    });

    it("按正文匹配 Understanding", async () => {
      const { code, stdout } = await runCommand(["search", "understandings", "server"]);
      expect(code).toBe(0);
      const results = parseJsonl(stdout);
      expect(results.length).toBeGreaterThan(0);
    });

    it("排除已删除的 Understanding", async () => {
      const { code, stdout } = await runCommand([
        "search",
        "understandings",
        "Soft Deleted Understanding A",
      ]);
      expect(code).toBe(0);
      const results = parseJsonl(stdout);
      expect(results.length).toBe(0);
    });

    it("无匹配结果时返回空", async () => {
      const { code, stdout } = await runCommand(["search", "understandings", "XYZZY_NONEXISTENT"]);
      expect(code).toBe(0);
      expect(stdout.trim()).toBe("");
    });

    it("使用 --limit 限制结果数", async () => {
      const { code, stdout } = await runCommand(["search", "understandings", "a", "--limit", "3"]);
      expect(code).toBe(0);
      expect(parseJsonl(stdout).length).toBeLessThanOrEqual(3);
    });
  });

  describe("search contexts", () => {
    it("按内容匹配 Context", async () => {
      const { code, stdout, stderr } = await runCommand(["search", "contexts", "Dockerfile"]);
      if (code !== 0) console.log("CTX SEARCH STDERR:", stderr);
      expect(code).toBe(0);
      const results = parseJsonl(stdout);
      expect(results.length).toBeGreaterThan(0);
    });

    it("无匹配结果时返回空", async () => {
      const { code, stdout } = await runCommand(["search", "contexts", "XYZZY_NONEXISTENT"]);
      expect(code).toBe(0);
      expect(stdout.trim()).toBe("");
    });
  });

  describe("search all", () => {
    it("同时检索 Understanding 与 Context", async () => {
      const { code, stdout } = await runCommand(["search", "all", "React"]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { understandings: unknown[]; contexts: unknown[] };
      expect(Array.isArray(data.understandings)).toBe(true);
      expect(Array.isArray(data.contexts)).toBe(true);
    });

    it("两者均无匹配", async () => {
      const { code, stdout } = await runCommand(["search", "all", "ZZZ_NO_MATCH"]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { understandings: unknown[]; contexts: unknown[] };
      expect(data.understandings.length).toBe(0);
      expect(data.contexts.length).toBe(0);
    });
  });
});
