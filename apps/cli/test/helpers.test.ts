import { describe, expect, test } from "vitest";
import { getCliTestRuntimeArgs } from "./helpers";

describe("CLI test runtime isolation", () => {
  test("refuses to resolve the default profile when test paths are missing", () => {
    expect(() => getCliTestRuntimeArgs({})).toThrow(
      "Refusing to run CLI tests without an isolated temporary database",
    );
  });
});
