import { describe, expect, test } from "vitest";
import {
  createChatComposerDocument,
  getChatComposerEntities,
  getChatComposerText,
} from "./document";

describe("Chat composer document", () => {
  test("round-trips text and entity mentions", () => {
    const document = createChatComposerDocument("Compare these ideas", [
      { type: "understanding", id: "u-1", label: "First idea" },
      { type: "context", id: "c-1", label: "A conversation" },
    ]);

    expect(getChatComposerText(document)).toBe("First idea A conversation Compare these ideas");
    expect(getChatComposerEntities(document)).toEqual([
      { type: "understanding", id: "u-1", label: "First idea" },
      { type: "context", id: "c-1", label: "A conversation" },
    ]);
  });

  test("deduplicates repeated entity nodes while preserving the latest label", () => {
    expect(
      getChatComposerEntities({
        type: "doc",
        content: [
          { type: "mention", attrs: { id: "domain:d-1", label: "Old" } },
          { type: "mention", attrs: { id: "domain:d-1", label: "Current" } },
        ],
      }),
    ).toEqual([{ type: "domain", id: "d-1", label: "Current" }]);
  });
});
