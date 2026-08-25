import { describe, expect, test } from "vitest";
import type { Domain } from "@shared/domain";
import type { SearchContextResult } from "@shared/search";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import type { CanvasDTO } from "@reflecta/shared";
import { buildContextCandidates } from "./context-candidates";

const understanding = (id: string, title: string | null, body: string): UnderstandingSummaryDTO =>
  ({ id, title, body }) as UnderstandingSummaryDTO;
const context = (contextId: string, title: string, snippet: string): SearchContextResult =>
  ({ contextId, understandingId: "u-x", title, snippet, rank: 0 }) as SearchContextResult;
const domain = (id: string, name: string): Domain => ({ id, name }) as Domain;
const canvas = (id: string, title: string): CanvasDTO => ({ id, title }) as CanvasDTO;

describe("buildContextCandidates", () => {
  test("type filter keeps only that type", () => {
    const result = buildContextCandidates({
      query: "AI",
      understandings: [understanding("u1", "AI 综述", "正文")],
      contexts: [context("c1", "AI 对话", "…")],
      domains: [domain("d1", "AI 领域")],
      canvases: [canvas("cv1", "AI 画布")],
      selected: [],
      type: "domain",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "domain", title: "AI 领域" });
  });

  test("exact domain name floats above body matches in All list", () => {
    const result = buildContextCandidates({
      query: "AI",
      understandings: [understanding("u1", "偏见与理性", "讨论 AI 相关的正文内容…")],
      contexts: [context("c1", "某次对话", "提到了 AI 的片段")],
      domains: [domain("d1", "AI")],
      canvases: [canvas("cv1", "AI 调研")],
      selected: [],
    });
    expect(result.map((r) => r.type)).toEqual(["domain", "canvas", "understanding", "context"]);
  });

  test("empty query keeps original type ordering", () => {
    const result = buildContextCandidates({
      query: "",
      understandings: [understanding("u1", "U", "")],
      contexts: [],
      domains: [domain("d1", "D")],
      canvases: [],
      selected: [],
    });
    expect(result.map((r) => r.type)).toEqual(["understanding", "domain"]);
  });
});
