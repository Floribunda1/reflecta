import { describe, expect, test } from "vitest";
import { getMarkdownPreviewText } from "./markdown-preview";

describe("getMarkdownPreviewText", () => {
  test("projects Markdown and wiki links to compact text", () => {
    expect(
      getMarkdownPreviewText(
        "# Heading\n\nConnect [[Alpha#understanding-1]] and [source](https://example.com).\n\n![diagram](asset:///diagram.png)",
      ),
    ).toBe("Heading\nConnect Alpha and source.\ndiagram");
  });

  test("limits the projected lines", () => {
    expect(getMarkdownPreviewText("one\n\ntwo\n\nthree", 2)).toBe("one\ntwo");
  });
});
