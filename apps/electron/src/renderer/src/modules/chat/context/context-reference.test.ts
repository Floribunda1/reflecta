import { describe, expect, test } from "vitest";
import {
  contextKey,
  contextMentionIcon,
  messageContextMentionClass,
  contextRefFromMention,
  contextTitle,
  contextTypeLabel,
  inspectableContextRef,
  parseContextKey,
  parseWikiHref,
  wikiHref,
  wikiMarkdownToLinks,
} from "./context-reference";

describe("context reference", () => {
  test("builds and parses context keys", () => {
    expect(contextKey({ type: "thought", id: "thought-1" })).toBe("thought:thought-1");
    expect(parseContextKey("context:context-1")).toEqual({ type: "context", id: "context-1" });
    expect(contextRefFromMention("category:category-1", "Category A")).toEqual({
      type: "category",
      id: "category-1",
      title: "Category A",
    });
  });

  test("ignores malformed mention ids", () => {
    expect(parseContextKey("thought")).toBeNull();
    expect(parseContextKey("note:1")).toBeNull();
    expect(parseContextKey("thought:")).toBeNull();
    expect(contextRefFromMention(undefined, "Title")).toBeNull();
  });

  test("formats labels, titles, icons, and inspectability", () => {
    expect(contextTitle({ type: "thought", id: "thought-1", title: "  A  " })).toBe("A");
    expect(contextTitle({ type: "context", id: "context-1" })).toBe("context:context-1");
    expect(contextTypeLabel("thought")).toBe("Thought");
    expect(contextTypeLabel("context")).toBe("Context");
    expect(contextTypeLabel("category")).toBe("Category");
    expect(contextMentionIcon("thought")).toBe("✦");
    expect(contextMentionIcon("context")).toBe("↳");
    expect(contextMentionIcon("category")).toBe("#");
    expect(inspectableContextRef({ type: "thought", id: "thought-1" })).toEqual({
      type: "thought",
      id: "thought-1",
    });
    expect(inspectableContextRef({ type: "category", id: "category-1" })).toBeNull();
  });

  test("keeps message mentions as inline text so they align with surrounding copy", () => {
    expect(messageContextMentionClass("category")).toContain("inline");
    expect(messageContextMentionClass("category")).not.toContain("inline-block");
    expect(messageContextMentionClass("category")).not.toContain("truncate");
  });

  test("builds and parses assistant wiki links", () => {
    const href = wikiHref("自信的状态", "thought-1");

    expect(parseWikiHref(href)).toEqual({
      type: "thought",
      id: "thought-1",
      title: "自信的状态",
    });
    expect(parseWikiHref("#elsewhere")).toBeNull();
    expect(wikiMarkdownToLinks("关联 [[自信的状态#thought-1]]")).toBe(`关联 [自信的状态](${href})`);
  });
});
