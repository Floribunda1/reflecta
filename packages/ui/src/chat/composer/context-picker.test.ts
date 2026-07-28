import { describe, expect, test } from "vitest";
import { nextContextPickerIndex } from "./context-picker";

describe("nextContextPickerIndex", () => {
  test("moves through candidates with wrapping", () => {
    expect(nextContextPickerIndex(0, 3, 1)).toBe(1);
    expect(nextContextPickerIndex(2, 3, 1)).toBe(0);
    expect(nextContextPickerIndex(0, 3, -1)).toBe(2);
  });

  test("keeps empty lists at zero", () => {
    expect(nextContextPickerIndex(4, 0, 1)).toBe(0);
  });
});
