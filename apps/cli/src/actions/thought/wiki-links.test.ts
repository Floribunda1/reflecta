import { describe, expect, it } from "vitest";
import { normalizeThoughtBody } from "./wiki-links";

describe("normalizeThoughtBody", () => {
  it("keeps undefined bodies unchanged", () => {
    expect(normalizeThoughtBody(undefined)).toBeUndefined();
  });

  it("canonicalizes title-id wikilinks", () => {
    expect(normalizeThoughtBody("See [[  primary thought  # thought-1 ]]")).toBe(
      "See [[primary thought#thought-1]]",
    );
  });
});
