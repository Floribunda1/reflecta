import { describe, expect, test } from "vitest";
import { shouldApplyInitialContext } from "./initial-context";

describe("ChatComposer initial context", () => {
  test("applies a new initial context only when the composer is empty", () => {
    expect(
      shouldApplyInitialContext({
        initialContextKey: "understanding:u1:1",
        editing: false,
        draft: "",
        fileCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldApplyInitialContext({
        initialContextKey: "understanding:u1:1",
        appliedInitialContextKey: "understanding:u1:1",
        editing: false,
        draft: "",
        fileCount: 0,
      }),
    ).toBe(false);

    expect(
      shouldApplyInitialContext({
        initialContextKey: "understanding:u1:2",
        editing: false,
        draft: "user draft",
        fileCount: 0,
      }),
    ).toBe(false);

    expect(
      shouldApplyInitialContext({
        initialContextKey: "understanding:u1:2",
        editing: false,
        draft: "",
        fileCount: 1,
      }),
    ).toBe(false);
  });
});
