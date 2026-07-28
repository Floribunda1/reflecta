import { describe, expect, test } from "vitest";
import {
  findUnderstandingWikiLinkAtOffset,
  formatUnderstandingWikiLink,
  normalizeUnderstandingWikiLinkBody,
  parseUnderstandingWikiLink,
  renderUnderstandingWikiLinksAsHtml,
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

  test("escapes wiki-link labels and ids before rendering HTML", () => {
    expect(renderUnderstandingWikiLinksAsHtml(`[[<script>alert("x")</script>#id-"unsafe]]`)).toBe(
      `<a href="#" data-wiki-link="id-&quot;unsafe" class="wiki-link">&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</a>`,
    );
  });
});
