import { describe, expect, test } from "vitest";
import { collectChatEntityReferences, replaceChatEntityReferences } from "./entity-reference-codec";

describe("chat entity reference codec", () => {
  test("collects unique direct references in first-seen order", () => {
    expect(
      collectChatEntityReferences("见 [[u:u_1]]、[[c:ctx_1]]、[[u:u_1]] 和 [[d:domain-1]]"),
    ).toEqual([
      { type: "understanding", id: "u_1" },
      { type: "context", id: "ctx_1" },
      { type: "domain", id: "domain-1" },
    ]);
  });

  test("replaces references without changing surrounding Markdown", () => {
    const markdown = "# 标题 [[u:u_1]]\n\n- **上下文** [[c:c_1]]";
    expect(replaceChatEntityReferences(markdown, ({ type, id }) => `<${type}:${id}>`)).toBe(
      "# 标题 <understanding:u_1>\n\n- **上下文** <context:c_1>",
    );
  });

  test("ignores code, escaped markers, and Markdown link labels", () => {
    const markdown = [
      "`[[u:inline]]`",
      "```ts\nconst ref = '[[c:fenced]]'\n```",
      "~~~\n[[d:tilde]]\n~~~",
      "\\[[u:escaped]]",
      "[已有链接 [[c:label]]](https://example.test)",
      "[[d:linked]](https://example.test)",
      "[[u:visible]]",
    ].join("\n");

    expect(collectChatEntityReferences(markdown)).toEqual([
      { type: "understanding", id: "visible" },
    ]);
  });

  test("protects unfinished code spans while Markdown is streaming", () => {
    expect(collectChatEntityReferences("```ts\n[[u:not-yet-visible]]")).toEqual([]);
    expect(collectChatEntityReferences("before `[[c:not-yet-visible]]")).toEqual([]);
  });

  test("preserves malformed markers", () => {
    const markdown = [
      "[[understanding:id]]",
      "[[u:title#id]]",
      "[[u: id]]",
      "[[x:id]]",
      "[[u:]]",
      "[[u:id",
    ].join(" ");
    expect(replaceChatEntityReferences(markdown, () => "replaced")).toBe(markdown);
  });
});
