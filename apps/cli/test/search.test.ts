import { describe, it, expect } from "vitest";
import { runCommand, parseJson } from "./helpers";

type SearchHit =
  | {
      type: "understanding";
      understanding: { id: string; title: string | null; body: string };
      matchedText?: string;
    }
  | {
      type: "context";
      context: { id: string; understandingId: string; title: string | null };
      understandingId: string;
      matchedText?: string;
    };

function hitsFrom(stdout: string): SearchHit[] {
  const data = parseJson(stdout) as { hits?: SearchHit[] };
  expect(Array.isArray(data.hits)).toBe(true);
  return data.hits!;
}

async function search(query: string): Promise<SearchHit[]> {
  const { code, stdout } = await runCommand(["search", query, "--format", "json"]);
  expect(code).toBe(0);
  return hitsFrom(stdout);
}

async function createUnderstanding(title: string, body: string): Promise<string> {
  const { code, stdout } = await runCommand([
    "understanding",
    "create",
    "--title",
    title,
    "--body",
    body,
    "--format",
    "json",
    "--yes",
  ]);
  expect(code).toBe(0);
  return (parseJson(stdout) as { id: string }).id;
}

describe("知识搜索", () => {
  describe("search", () => {
    it("返回混合的 Understanding 与 Context 命中", async () => {
      const hits = await search("React");
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((hit) => ["understanding", "context"].includes(hit.type))).toBe(true);
    });

    it("Context 命中包含所属 Understanding ID", async () => {
      const understandingId = await createUnderstanding(
        "Context Parent Search Test",
        "This understanding owns a context hit.",
      );
      const { code, stdout } = await runCommand([
        "context",
        "create",
        "--understanding-id",
        understandingId,
        "--medium",
        "article",
        "--title",
        "Parent Context",
        "--content",
        "parentcontextsignal appears only in this context.",
        "--format",
        "json",
        "--yes",
      ]);
      expect(code).toBe(0);
      const contextId = (parseJson(stdout) as { id: string }).id;

      const hits = await search("parentcontextsignal");
      const contextHit = hits.find((hit) => hit.type === "context" && hit.context.id === contextId);

      expect(contextHit?.understandingId).toBe(understandingId);
    });

    it("按词面关键词返回新创建的 Context", async () => {
      const understandingId = await createUnderstanding(
        "Lexical Search Test",
        "This understanding owns a searchable context.",
      );
      const { code, stdout } = await runCommand([
        "context",
        "create",
        "--understanding-id",
        understandingId,
        "--medium",
        "experience",
        "--title",
        "Lexical Context",
        "--content",
        "lexicalsignalaltair appears only in this context.",
        "--format",
        "json",
        "--yes",
      ]);
      expect(code).toBe(0);
      const contextId = (parseJson(stdout) as { id: string }).id;

      const hits = await search("lexicalsignalaltair");

      expect(hits.some((hit) => hit.type === "context" && hit.context.id === contextId)).toBe(true);
    });

    it("按语义返回表达不同但含义相关的 Understanding", async () => {
      const understandingId = await createUnderstanding(
        "Agent Acceptance Criteria",
        "验收标准让 AI 产出保持可控，团队用清晰 check 判断任务是否完成。",
      );

      const hits = await search("怎样让模型回复更稳定可靠");

      expect(
        hits.some(
          (hit) => hit.type === "understanding" && hit.understanding.id === understandingId,
        ),
      ).toBe(true);
    });

    it("更新和删除后搜索结果反映最新知识状态", async () => {
      const understandingId = await createUnderstanding(
        "Mutable Search Test",
        "searchstatebeforemarker is present before the update.",
      );
      expect(
        (await search("searchstatebeforemarker")).some(
          (hit) => hit.type === "understanding" && hit.understanding.id === understandingId,
        ),
      ).toBe(true);

      const update = await runCommand([
        "understanding",
        "update",
        understandingId,
        "--body",
        "searchstateaftermarker is present after the update.",
        "--format",
        "json",
        "--yes",
      ]);
      expect(update.code).toBe(0);
      expect(
        (await search("searchstatebeforemarker")).some(
          (hit) => hit.type === "understanding" && hit.understanding.id === understandingId,
        ),
      ).toBe(false);
      expect(
        (await search("searchstateaftermarker")).some(
          (hit) => hit.type === "understanding" && hit.understanding.id === understandingId,
        ),
      ).toBe(true);

      const deletion = await runCommand(["understanding", "delete", understandingId, "--yes"]);
      expect(deletion.code).toBe(0);
      expect(
        (await search("searchstateaftermarker")).some(
          (hit) => hit.type === "understanding" && hit.understanding.id === understandingId,
        ),
      ).toBe(false);
    });

    it("无匹配时返回空 hits", async () => {
      const { code, stdout } = await runCommand(["search", "ZZZ_NO_MATCH", "--format", "json"]);
      expect(code).toBe(0);
      expect(parseJson(stdout)).toEqual({ hits: [] });
    });
  });
});
