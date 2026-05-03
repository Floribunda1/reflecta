import { describe, it, expect } from "vitest";
import { runCommand, parseJsonl, parseJson } from "./helpers";

describe("全文检索", () => {
  describe("search thoughts", () => {
    it("按标题匹配 Thought", async () => {
      const { code, stdout } = await runCommand(["search", "thoughts", "React"]);
      expect(code).toBe(0);
      const results = parseJsonl(stdout);
      expect(results.length).toBeGreaterThan(0);
    });

    it("按正文匹配 Thought", async () => {
      const { code, stdout } = await runCommand(["search", "thoughts", "server"]);
      expect(code).toBe(0);
      const results = parseJsonl(stdout);
      expect(results.length).toBeGreaterThan(0);
    });

    it("排除已删除的 Thought", async () => {
      const { code, stdout } = await runCommand(["search", "thoughts", "Soft Deleted Thought A"]);
      expect(code).toBe(0);
      const results = parseJsonl(stdout);
      expect(results.length).toBe(0);
    });

    it("无匹配结果时返回空", async () => {
      const { code, stdout } = await runCommand(["search", "thoughts", "XYZZY_NONEXISTENT"]);
      expect(code).toBe(0);
      expect(stdout.trim()).toBe("");
    });

    it("使用 --limit 限制结果数", async () => {
      const { code, stdout } = await runCommand(["search", "thoughts", "a", "--limit", "3"]);
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
    it("同时检索 Thought 与 Context", async () => {
      const { code, stdout } = await runCommand(["search", "all", "React"]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { thoughts: unknown[]; contexts: unknown[] };
      expect(Array.isArray(data.thoughts)).toBe(true);
      expect(Array.isArray(data.contexts)).toBe(true);
    });

    it("两者均无匹配", async () => {
      const { code, stdout } = await runCommand(["search", "all", "ZZZ_NO_MATCH"]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { thoughts: unknown[]; contexts: unknown[] };
      expect(data.thoughts.length).toBe(0);
      expect(data.contexts.length).toBe(0);
    });
  });
});
