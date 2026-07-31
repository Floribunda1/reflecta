import { describe, expect, test } from "vitest";
import { extractUnderstandingWikiLinkTargets, formatUnderstandingWikiLink } from "./wiki-links";

describe("Understanding entity references", () => {
  test("uses typed refs and only derives relationships from Understanding refs", () => {
    expect(formatUnderstandingWikiLink({ id: "understanding-1" })).toBe("[[u:understanding-1]]");
    expect(
      extractUnderstandingWikiLinkTargets(
        "[[u:understanding-1]] [[c:context-1]] [[d:domain-1]] [[u:understanding-1]]",
      ),
    ).toEqual(["understanding-1"]);
  });
});
