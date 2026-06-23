import { describe, it, expect } from "vitest";
import { runCommand, parseJson } from "./helpers";

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
    it("无匹配时返回空 hits", async () => {
      const { code, stdout } = await runCommand(["search", "ZZZ_NO_MATCH", "--format", "json"]);
      expect(code).toBe(0);
      expect(parseJson(stdout)).toEqual({ hits: [] });
    });
  });
});
