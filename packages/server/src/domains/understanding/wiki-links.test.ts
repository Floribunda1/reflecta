import { describe, expect, test } from "vitest";
import { collectEntityReferences, formatEntityReference } from "@reflecta/shared";

describe("Understanding entity references", () => {
  test("uses typed refs and only derives relationships from Understanding refs", () => {
    expect(formatEntityReference({ type: "understanding", id: "understanding-1" })).toBe(
      "[[u:understanding-1]]",
    );
    // 与 core.ts syncWikiLinkMentions 的过滤逻辑保持一致（u-only + 去重）
    const body = "[[u:understanding-1]] [[c:context-1]] [[d:domain-1]] [[u:understanding-1]]";
    expect(
      collectEntityReferences(body)
        .filter((reference) => reference.type === "understanding")
        .map((reference) => reference.id),
    ).toEqual(["understanding-1"]);
  });
});
