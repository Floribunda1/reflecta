import { describe, expect, test } from "vitest";
import { buildSnippet } from "./core";

describe("buildSnippet（A5 引文式 snippet）", () => {
  test("短文本（≤上限）原样返回", () => {
    const text = "这是很短的内容。";
    expect(buildSnippet(text)).toBe(text);
  });

  test("长文本在句号边界截断，不截到句子中间", () => {
    const text = `${"第一句话的内容。".repeat(30)}最后一句未完成的话`;
    const snippet = buildSnippet(text);
    expect(snippet.length).toBeLessThanOrEqual(240);
    // 截断点在句号后（如果找到边界），不以未完成的句子结尾
    expect(snippet.endsWith("。")).toBe(true);
    expect(snippet).not.toContain("最后一句未完成的话");
  });

  test("长文本在换行边界截断（Markdown 结构安全）", () => {
    // 用换行分隔的长文本
    const lines = Array.from({ length: 30 }, (_, i) => `第${i + 1}行内容，有一些文字。`);
    const text = lines.join("\n");
    const snippet = buildSnippet(text);
    expect(snippet.length).toBeLessThanOrEqual(240);
    // 应该在换行处断（如果 boundary 命中），不会截断到一行中间
    expect(snippet.endsWith("\n") || snippet.endsWith("。")).toBe(true);
  });

  test("无合适边界时截断并加省略号", () => {
    // 一个超长的连续字符串，无标点无换行
    const text = "这是一个没有标点没有换行的超长连续字符串".repeat(40);
    const snippet = buildSnippet(text);
    expect(snippet.length).toBeLessThanOrEqual(240 + 1); // 省略号
    expect(snippet.endsWith("…")).toBe(true);
  });

  test("空串/空白返回空", () => {
    expect(buildSnippet("")).toBe("");
    expect(buildSnippet("   ")).toBe("");
  });

  test("恰好等于上限的原样返回", () => {
    const text = "甲".repeat(240);
    expect(buildSnippet(text)).toBe(text);
  });
});
