import { describe, expect, it } from "vitest";
import { normalizeThoughtBody } from "./wiki-links";

describe("normalizeThoughtBody", () => {
  it("keeps undefined bodies unchanged", () => {
    expect(normalizeThoughtBody(undefined)).toBeUndefined();
  });

  it("normalizes markdown wiki links into title-id wikilinks", () => {
    expect(
      normalizeThoughtBody("Connect [thought-1](/wiki/thought-1) to [thought-2](/wiki/thought-2)"),
    ).toBe("Connect [[thought-1#thought-1]] to [[thought-2#thought-2]]");
  });

  it("normalizes alias wikilinks into title-id wikilinks", () => {
    expect(normalizeThoughtBody("Connect [[thought-1]] to [[thought-2]]")).toBe(
      "Connect [[thought-1]] to [[thought-2]]",
    );
  });

  it("supports label-target legacy aliases", () => {
    expect(normalizeThoughtBody("See [[thought-1|primary thought]]")).toBe(
      "See [[primary thought#thought-1]]",
    );
  });

  it("canonicalizes title-id wikilinks", () => {
    expect(normalizeThoughtBody("See [[  primary thought  # thought-1 ]]")).toBe(
      "See [[primary thought#thought-1]]",
    );
  });
});
