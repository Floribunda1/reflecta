import { describe, expect, it } from "vitest";
import {
  extractThoughtWikiLinkTargets,
  formatThoughtWikiLink,
  normalizeThoughtWikiLinkBody,
  parseThoughtWikiLink,
} from "./wiki-links";

describe("thought wiki links", () => {
  it("formats title-id links", () => {
    expect(formatThoughtWikiLink({ title: "Primary Thought", id: "th_1" })).toBe(
      "[[Primary Thought#th_1]]",
    );
  });

  it("parses title-id links", () => {
    expect(parseThoughtWikiLink("[[Primary Thought#th_1]]")).toEqual({
      title: "Primary Thought",
      id: "th_1",
    });
  });

  it("normalizes escaped remark output back into title-id links", () => {
    expect(normalizeThoughtWikiLinkBody("\\[\\[Primary Thought#th\\_1]]")).toBe(
      "[[Primary Thought#th_1]]",
    );
  });

  it("extracts unique target ids", () => {
    expect(
      extractThoughtWikiLinkTargets(
        "See [[Primary Thought#th_1]] then [[Another#th_2]] and [[Primary Thought#th_1]] again",
      ),
    ).toEqual(["th_1", "th_2"]);
  });
});
