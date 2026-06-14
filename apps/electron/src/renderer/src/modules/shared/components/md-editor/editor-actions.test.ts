// @vitest-environment happy-dom

import { afterEach, describe, expect, test } from "vitest";
import type { Editor } from "@milkdown/core";
import { TextSelection } from "@milkdown/prose/state";
import {
  createReflectaMilkdownEditor,
  getMilkdownMarkdown,
} from "./milkdown-editor";
import {
  findWikiLinkTrigger,
  insertMarkdownReplacingTrigger,
} from "./editor-actions";

const editors: Editor[] = [];

afterEach(async () => {
  await Promise.all(editors.map((editor) => editor.destroy()));
  editors.length = 0;
});

describe("editor actions", () => {
  test("detects wiki link triggers from text before the cursor", () => {
    expect(findWikiLinkTrigger("[[")).toEqual({ fromOffset: 0, query: "" });
    expect(findWikiLinkTrigger("Connect [[Al")).toEqual({ fromOffset: 8, query: "Al" });
    expect(findWikiLinkTrigger("[[closed]]")).toBeNull();
  });

  test("replaces a wiki trigger with an id-backed wiki link", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const editor = await createReflectaMilkdownEditor({ root, content: "Connect [[" });
    editors.push(editor);

    const view = editor.ctx.get((await import("@milkdown/core")).editorViewCtx);
    view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));

    insertMarkdownReplacingTrigger(editor, {
      fromOffset: "Connect ".length,
      markdown: "[[Alpha#thought-1]]",
    });

    expect(getMilkdownMarkdown(editor)).toContain("Connect [[Alpha#thought-1]]");
  });
});
