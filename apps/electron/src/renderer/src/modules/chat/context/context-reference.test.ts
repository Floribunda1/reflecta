import { describe, expect, test } from "vitest";
import {
  contextKey,
  contextMentionIcon,
  contextRefFromMention,
  contextTitle,
  contextTypeLabel,
  inspectableContextRef,
  parseContextKey,
  parseEntityCitationHref,
  parseWikiHref,
  referenceMarkdownToLinks,
  wikiHref,
  wikiMarkdownToLinks,
} from "./context-reference";

describe("context reference", () => {
  test("builds and parses context keys", () => {
    expect(contextKey({ type: "understanding", id: "understanding-1" })).toBe(
      "understanding:understanding-1",
    );
    expect(parseContextKey("context:context-1")).toEqual({ type: "context", id: "context-1" });
    expect(contextRefFromMention("domain:domain-1", "Domain A")).toEqual({
      type: "domain",
      id: "domain-1",
      title: "Domain A",
    });
  });

  test("ignores malformed mention ids", () => {
    expect(parseContextKey("understanding")).toBeNull();
    expect(parseContextKey("unknown:1")).toBeNull();
    expect(parseContextKey("understanding:")).toBeNull();
    expect(contextRefFromMention(undefined, "Title")).toBeNull();
  });

  test("formats labels, titles, icons, and inspectability", () => {
    expect(contextTitle({ type: "understanding", id: "understanding-1", title: "  A  " })).toBe(
      "A",
    );
    expect(contextTitle({ type: "context", id: "context-1" })).toBe("context:context-1");
    expect(contextTypeLabel("understanding")).toBe("Understanding");
    expect(contextTypeLabel("context")).toBe("Context");
    expect(contextTypeLabel("domain")).toBe("Domain");
    expect(contextMentionIcon("understanding")).toBe("✦");
    expect(contextMentionIcon("context")).toBe("↳");
    expect(contextMentionIcon("domain")).toBe("#");
    expect(inspectableContextRef({ type: "understanding", id: "understanding-1" })).toEqual({
      type: "understanding",
      id: "understanding-1",
    });
    expect(inspectableContextRef({ type: "domain", id: "domain-1" })).toBeNull();
  });

  test("builds and parses assistant wiki links", () => {
    const href = wikiHref("自信的状态", "understanding-1");

    expect(parseWikiHref(href)).toEqual({
      type: "understanding",
      id: "understanding-1",
      title: "自信的状态",
    });
    expect(parseWikiHref("#elsewhere")).toBeNull();
    expect(wikiMarkdownToLinks("关联 [[自信的状态#understanding-1]]")).toBe(
      `关联 [自信的状态](${href})`,
    );
  });

  test("converts direct entity citations with explicit short types", () => {
    const converted = referenceMarkdownToLinks("见 [[u:u_1]]、[[c:ctx_1]] 和 [[d:domain_1]]");

    expect(converted).toContain("[understanding:u_1](#reflecta-entity/understanding/u_1)");
    expect(converted).toContain("[context:ctx_1](#reflecta-entity/context/ctx_1)");
    expect(converted).toContain("[domain:domain_1](#reflecta-entity/domain/domain_1)");
    expect(parseEntityCitationHref("#reflecta-entity/context/ctx_1")).toEqual({
      type: "context",
      id: "ctx_1",
    });
  });

  test("does not convert typed refs inside inline code", () => {
    expect(referenceMarkdownToLinks("见 `[[d:domain_1]]`")).toBe("见 `[[d:domain_1]]`");
  });

  test("preserves ids exactly and rejects malformed markers", () => {
    const valid = referenceMarkdownToLinks("[[u:AbC_1-xYz]]");
    expect(valid).toContain("understanding/AbC_1-xYz");
    for (const marker of [
      "[[understanding:id]]",
      "[[u:title#id]]",
      "[[u: id]]",
      "[[x:id]]",
      "[[u:]]",
      "[[u:id",
      "[[u:id\nnext]]",
    ]) {
      expect(referenceMarkdownToLinks(marker)).toBe(marker);
    }
  });

  test("does not create nested links or parse escaped markers", () => {
    for (const markdown of [
      "[已有链接 [[u:u_1]]](https://example.test)",
      "![图片 [[c:c_1]]](image.png)",
      "\\[[d:d_1]]",
      "[[u:u_1]](https://example.test)",
    ]) {
      expect(referenceMarkdownToLinks(markdown)).toBe(markdown);
    }
  });

  test("keeps surrounding Markdown unchanged", () => {
    const markdown = "# 标题 [[u:u_1]]\n\n- **上下文** [[c:c_1]]\n\n普通 [括号] 和 [[d:d_1]]";
    const result = referenceMarkdownToLinks(markdown);

    expect(result).toContain("# 标题 [understanding:u_1]");
    expect(result).toContain("- **上下文** [context:c_1]");
    expect(result).toContain("普通 [括号] 和 [domain:d_1]");
  });

  test("does not convert typed title links", () => {
    expect(wikiMarkdownToLinks("关联 [[context:一次复盘#ctx_1]]")).toBe(
      "关联 [[context:一次复盘#ctx_1]]",
    );
  });
});
