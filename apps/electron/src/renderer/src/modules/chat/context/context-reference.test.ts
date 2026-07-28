import { describe, expect, test } from "vitest";
import { contextKey } from "./context-reference";

describe("context reference", () => {
  test("builds stable context keys", () => {
    expect(contextKey({ type: "understanding", id: "understanding-1" })).toBe(
      "understanding:understanding-1",
    );
  });
});
