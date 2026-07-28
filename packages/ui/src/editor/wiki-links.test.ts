import { describe, expect, test } from "vitest";
import {
  findUnderstandingWikiLinkAtOffset,
  formatUnderstandingWikiLink,
  normalizeUnderstandingWikiLinkBody,
  parseUnderstandingWikiLink,
} from "./wiki-links";

describe("Understanding wiki links", () => {
  test("formats and parses an id-backed link", () => {
    const markdown = formatUnderstandingWikiLink({ id: "understanding-1", title: " Alpha " });

    expect(markdown).toBe("[[Alpha#understanding-1]]");
    expect(parseUnderstandingWikiLink(markdown)).toEqual({
      id: "understanding-1",
      title: "Alpha",
    });
  });

  test("normalizes escaped links and resolves a link at the cursor", () => {
    const markdown = normalizeUnderstandingWikiLinkBody(
      String.raw`Before \[\[Alpha#understanding-1]] after`,
    );

    expect(markdown).toBe("Before [[Alpha#understanding-1]] after");
    expect(findUnderstandingWikiLinkAtOffset(markdown, 12)).toEqual({
      id: "understanding-1",
      title: "Alpha",
    });
  });

  test("rejects links without a title or id", () => {
    expect(parseUnderstandingWikiLink("[[Alpha]]")).toBeNull();
    expect(parseUnderstandingWikiLink("[[#understanding-1]]")).toBeNull();
  });
});
