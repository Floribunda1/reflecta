import { describe, expect, test } from "vitest";
import { createChatSearchRehypePlugin, findChatTextRanges } from "./chat-search";

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

test("keeps Markdown match IDs stable when the processor renders again", () => {
  const state = { messageId: "message", query: "find", nextMatchIndex: 0 };
  const transform = createChatSearchRehypePlugin(state)();
  const tree = () => ({ type: "root", children: [{ type: "text", value: "find and find" }] });
  const first = tree();
  transform(first);
  const repeated = tree();
  transform(repeated);
  expect(repeated).toEqual(first);
  expect(state.nextMatchIndex).toBe(2);
});

test("reserves distinct IDs across Markdown blocks despite reprocessing", () => {
  const state = { messageId: "message", query: "find", nextMatchIndex: 0 };
  const tree = () => ({ type: "root", children: [{ type: "text", value: "find" }] });
  const first = createChatSearchRehypePlugin(state)();
  first(tree());
  createChatSearchRehypePlugin(state)()(tree());
  first(tree());
  const third = tree();
  createChatSearchRehypePlugin(state)()(third);
  expect(third.children[0]).toMatchObject({
    properties: { "data-chat-find-match-index": "2" },
  });
  expect(state.nextMatchIndex).toBe(3);
});
