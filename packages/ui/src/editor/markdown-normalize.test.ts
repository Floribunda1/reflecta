import { describe, expect, test } from "vitest";
import { markdownEquals, normalizeMarkdown } from "./markdown-normalize";

describe("Markdown normalization", () => {
  test("normalizes escaped wiki links and trailing newlines", () => {
    expect(normalizeMarkdown(String.raw`Connect \[\[Alpha#one]]` + "\n\n")).toBe(
      "Connect [[Alpha#one]]",
    );
  });

  test("compares normalized documents", () => {
    expect(markdownEquals("Body\n", "Body")).toBe(true);
    expect(markdownEquals("Body", "Changed")).toBe(false);
  });
});
