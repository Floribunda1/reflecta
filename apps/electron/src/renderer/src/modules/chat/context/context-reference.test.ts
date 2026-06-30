import { describe, expect, test } from "vitest";
import {
  contextKey,
  contextMentionIcon,
  contextRefFromMention,
  contextTitle,
  contextTypeLabel,
  inspectableContextRef,
  parseContextKey,
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

  test("converts typed real-id entity refs", () => {
    const markdown = referenceMarkdownToLinks("见 [[context:ctx_1]]");
    const href = markdown.match(/\(([^)]+)\)/)?.[1];

    expect(parseWikiHref(href)).toEqual({
      type: "context",
      id: "ctx_1",
      title: undefined,
    });
  });

  test("parses typed real-id context links as context", () => {
    const markdown = wikiMarkdownToLinks("关联 [[context:一次复盘#ctx_1]]");
    const href = markdown.match(/\(([^)]+)\)/)?.[1];

    expect(parseWikiHref(href)).toEqual({
      type: "context",
      id: "ctx_1",
      title: "一次复盘",
    });
  });
});
