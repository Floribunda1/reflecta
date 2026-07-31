import { describe, expect, test } from "vitest";
import {
  findUnderstandingWikiLinkAtOffset,
  formatUnderstandingWikiLink,
  normalizeUnderstandingWikiLinkBody,
  parseUnderstandingWikiLink,
  renderUnderstandingWikiLinksAsHtml,
} from "./wiki-links";

describe("Understanding wiki links", () => {
  test("uses the shared typed entity-reference syntax", () => {
    const markdown = formatUnderstandingWikiLink({ id: "understanding-1", title: "Alpha" });

    expect(markdown).toBe("[[u:understanding-1]]");
    expect(parseUnderstandingWikiLink(markdown)).toEqual({ id: "understanding-1" });
  });

  test("normalizes escaped links and resolves a link at the cursor", () => {
    const markdown = normalizeUnderstandingWikiLinkBody(
      String.raw`Before \[\[u:understanding-1]] after`,
    );

    expect(markdown).toBe("Before [[u:understanding-1]] after");
    expect(findUnderstandingWikiLinkAtOffset(markdown, 12)).toEqual({
      id: "understanding-1",
    });
  });

  test("rejects legacy and untyped links", () => {
    expect(parseUnderstandingWikiLink("[[Alpha]]")).toBeNull();
    expect(parseUnderstandingWikiLink("[[Alpha#understanding-1]]")).toBeNull();
  });

  test("renders canonical links as entity anchors", () => {
    expect(renderUnderstandingWikiLinksAsHtml("[[u:understanding-1]]")).toBe(
      '<a href="#" data-wiki-link="understanding-1" data-entity-type="understanding" class="wiki-link">✦ understanding-1</a>',
    );
  });
});
