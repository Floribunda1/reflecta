import { describe, expect, test } from "vitest";
import {
  collectEntityReferences,
  formatEntityReference,
  normalizeEntityReferenceEscapes,
  parseEntityReference,
  replaceEntityReferences,
  scanEntityReferences,
} from "./entity-reference-codec";

describe("entity reference codec", () => {
  test("formats and parses the shared typed syntax", () => {
    expect(formatEntityReference({ type: "understanding", id: "u_1" })).toBe("[[u:u_1]]");
    expect(formatEntityReference({ type: "context", id: "c_1" })).toBe("[[c:c_1]]");
    expect(formatEntityReference({ type: "domain", id: "d_1" })).toBe("[[d:d_1]]");
    expect(formatEntityReference({ type: "canvas", id: "cv_1" })).toBe("[[cv:cv_1]]");
    expect(formatEntityReference({ type: "conversation", id: "s_1" })).toBe("[[s:s_1]]");
    expect(parseEntityReference("[[uv:not-a-canvas]]")).toBeNull();
    expect(parseEntityReference("[[u:u_1]]")).toEqual({ type: "understanding", id: "u_1" });
    expect(parseEntityReference("[[cv:canvas-1]]")).toEqual({ type: "canvas", id: "canvas-1" });
    expect(parseEntityReference("[[s:s_1]]")).toEqual({ type: "conversation", id: "s_1" });
  });

  test("scans hits with source positions in order", () => {
    expect(scanEntityReferences("见 [[u:u_1]] 和 [[c:c_1]]")).toEqual([
      {
        reference: { type: "understanding", id: "u_1" },
        start: 2,
        end: 11,
        source: "[[u:u_1]]",
      },
      {
        reference: { type: "context", id: "c_1" },
        start: 14,
        end: 23,
        source: "[[c:c_1]]",
      },
    ]);
  });

  test("collects unique references in first-seen order", () => {
    expect(
      collectEntityReferences("见 [[u:u_1]]、[[c:ctx_1]]、[[u:u_1]] 和 [[d:domain-1]]"),
    ).toEqual([
      { type: "understanding", id: "u_1" },
      { type: "context", id: "ctx_1" },
      { type: "domain", id: "domain-1" },
    ]);
  });

  test("collects canvas references too (single syntax, five prefixes)", () => {
    expect(collectEntityReferences("画布 [[cv:canvas-1]]、对话 [[s:s_1]] 和 [[u:u_1]]")).toEqual([
      { type: "canvas", id: "canvas-1" },
      { type: "conversation", id: "s_1" },
      { type: "understanding", id: "u_1" },
    ]);
  });

  test("replaces references without changing surrounding Markdown", () => {
    const markdown = "# 标题 [[u:u_1]]\n\n- **上下文** [[c:c_1]]";
    expect(replaceEntityReferences(markdown, ({ type, id }) => `<${type}:${id}>`)).toBe(
      "# 标题 <understanding:u_1>\n\n- **上下文** <context:c_1>",
    );
  });

  test("ignores code, escaped markers, and Markdown link labels by default", () => {
    const markdown = [
      "`[[u:inline]]`",
      "```ts\nconst ref = '[[c:fenced]]'\n```",
      "~~~\n[[d:tilde]]\n~~~",
      "\\[[u:escaped]]",
      "[已有链接 [[c:label]]](https://example.test)",
      "[[d:linked]](https://example.test)",
      "[[u:visible]]",
    ].join("\n");

    expect(collectEntityReferences(markdown)).toEqual([{ type: "understanding", id: "visible" }]);
  });

  test("protects unfinished code spans while Markdown is streaming", () => {
    expect(collectEntityReferences("```ts\n[[u:not-yet-visible]]")).toEqual([]);
    expect(collectEntityReferences("before `[[c:not-yet-visible]]")).toEqual([]);
  });

  test("protectEscapes:false treats escaped markers as real references (editor policy)", () => {
    expect(collectEntityReferences("\\[[u:escaped]]", { protectEscapes: false })).toEqual([
      { type: "understanding", id: "escaped" },
    ]);
    expect(collectEntityReferences("\\[[u:kept]]", { protectEscapes: true })).toEqual([]);
  });

  test("protectLinkLabels:false accepts markers inside link labels (chat policy)", () => {
    const markdown = "[label [[u:lbl]]](https://example.test)";
    expect(collectEntityReferences(markdown, { protectLinkLabels: false })).toEqual([
      { type: "understanding", id: "lbl" },
    ]);
    expect(collectEntityReferences(markdown)).toEqual([]);
  });

  test("preserves malformed markers", () => {
    const markdown = [
      "[[understanding:id]]",
      "[[u:title#id]]",
      "[[u: id]]",
      "[[x:id]]",
      "[[u:]]",
      "[[u:id",
    ].join(" ");
    expect(replaceEntityReferences(markdown, () => "replaced")).toBe(markdown);
  });

  test("normalizes escaped markers for all prefixes", () => {
    // 输入为双重转义 `\[\[u:id]]`（markdown 源能原样显示的转义形态，历史/导入数据）
    expect(
      normalizeEntityReferenceEscapes("见 \\[\\[u:u_1]]、\\[\\[cv:cv_1]]、\\[\\[s:s_1]]"),
    ).toBe("见 [[u:u_1]]、[[cv:cv_1]]、[[s:s_1]]");
    expect(normalizeEntityReferenceEscapes(undefined)).toBeUndefined();
  });
});
