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

  it("normalizes legacy markdown wiki links", () => {
    expect(normalizeThoughtWikiLinkBody("See [Primary Thought](/wiki/th_1)")).toBe(
      "See [[Primary Thought#th_1]]",
    );
  });

  it("normalizes legacy alias wiki links", () => {
    expect(normalizeThoughtWikiLinkBody("See [[th_1|Primary Thought]]")).toBe(
      "See [[Primary Thought#th_1]]",
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
