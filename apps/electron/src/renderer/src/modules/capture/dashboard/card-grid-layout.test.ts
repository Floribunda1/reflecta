import { describe, expect, test } from "vitest";
import {
  captureGridColumnCount,
  captureGridRowCount,
  captureGridRowSlice,
  captureGridVisibleSlice,
} from "./card-grid-layout";

describe("captureGridColumnCount", () => {
  test("follows the grid container width, not the viewport", () => {
    expect(captureGridColumnCount(0)).toBe(1);
    expect(captureGridColumnCount(239)).toBe(1);
    expect(captureGridColumnCount(240)).toBe(1);
    expect(captureGridColumnCount(492)).toBe(2);
    expect(captureGridColumnCount(744)).toBe(3);
    expect(captureGridColumnCount(996)).toBe(4);
    expect(captureGridColumnCount(1600)).toBe(4);
  });
});

describe("capture grid windowing", () => {
  const items = ["a", "b", "c", "d", "e"];

  test("counts rows from item count and columns", () => {
    expect(captureGridRowCount(0, 3)).toBe(0);
    expect(captureGridRowCount(5, 3)).toBe(2);
    expect(captureGridRowCount(4, 4)).toBe(1);
  });

  test("slices one row without inventing empty cells", () => {
    expect(captureGridRowSlice(items, 0, 3)).toEqual(["a", "b", "c"]);
    expect(captureGridRowSlice(items, 1, 3)).toEqual(["d", "e"]);
  });

  test("slices the visible row window for entity lookup", () => {
    expect(captureGridVisibleSlice(items, 0, 0, 3)).toEqual(["a", "b", "c"]);
    expect(captureGridVisibleSlice(items, 1, 1, 3)).toEqual(["d", "e"]);
    expect(captureGridVisibleSlice(items, 0, 1, 3)).toEqual(items);
  });
});
