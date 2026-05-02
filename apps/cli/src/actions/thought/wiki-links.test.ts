import { describe, expect, it } from "vitest";
import { normalizeThoughtBody } from "./wiki-links";

describe("normalizeThoughtBody", () => {
  it("keeps undefined bodies unchanged", () => {
    expect(normalizeThoughtBody(undefined)).toBeUndefined();
  });

  it("converts basic wikilinks into markdown wiki links", () => {
    expect(normalizeThoughtBody("Connect [[thought-1]] to [[thought-2]]")).toBe(
      "Connect [thought-1](/wiki/thought-1) to [thought-2](/wiki/thought-2)",
    );
  });

  it("supports alias labels", () => {
    expect(normalizeThoughtBody("See [[thought-1|primary thought]]")).toBe(
      "See [primary thought](/wiki/thought-1)",
    );
  });

  it("leaves malformed wikilinks unchanged", () => {
    expect(normalizeThoughtBody("Broken [[ |label]] and [[target| ]]")).toBe(
      "Broken [[ |label]] and [[target| ]]",
    );
  });
});
