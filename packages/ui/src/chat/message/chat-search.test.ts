import { describe, expect, test } from "vitest";
import { findChatTextRanges } from "./chat-search";

describe("findChatTextRanges", () => {
  test("finds non-overlapping case-insensitive matches", () => {
    expect(findChatTextRanges("Stream stream STREAM", "stream")).toEqual([
      { start: 0, end: 6 },
      { start: 7, end: 13 },
      { start: 14, end: 20 },
    ]);
  });

  test("ignores empty queries", () => {
    expect(findChatTextRanges("text", "  ")).toEqual([]);
  });
});
