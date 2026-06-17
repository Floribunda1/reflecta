// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from "vitest";
import { editorViewCtx } from "@milkdown/core";
import type { Editor } from "@milkdown/core";
import { createReflectaMilkdownEditor, getMilkdownMarkdown } from "../milkdown-editor";
import type { WikiLinkSuggestionItem, WikiLinkSuggestionSource } from "./types";

const editors: Editor[] = [];

afterEach(async () => {
  await Promise.all(editors.map((editor) => editor.destroy()));
  editors.length = 0;
  document.body.replaceChildren();
});

function pressKey(editor: Editor, key: string): boolean {
  const view = editor.ctx.get(editorViewCtx);
  const event = new KeyboardEvent("keydown", { key, cancelable: true });
  let handled = false;

  view.someProp("handleKeyDown", (handler) => {
    if (handled) return true;
    handled = handler(view, event) === true;
    return handled;
  });

  return handled;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 180));
}

async function createEditor(source: WikiLinkSuggestionSource, readonly = false): Promise<Editor> {
  const root = document.createElement("div");
  document.body.append(root);
  const editor = await createReflectaMilkdownEditor({
    root,
    content: "",
    readonly,
    wikiLinkSuggestionSource: source,
  });
  editors.push(editor);
  return editor;
}

function insertText(editor: Editor, text: string): void {
  const view = editor.ctx.get(editorViewCtx);
  view.dispatch(view.state.tr.insertText(text));
}

const alpha: WikiLinkSuggestionItem = {
  id: "thought-1",
  title: "Alpha",
  markdown: "[[Alpha#thought-1]]",
};

const beta: WikiLinkSuggestionItem = {
  id: "thought-2",
  title: "Beta",
  markdown: "[[Beta#thought-2]]",
};

describe("wiki link suggestion plugin", () => {
  test("opens on [[ and updates the query while typing", async () => {
    const source = vi.fn<WikiLinkSuggestionSource>().mockResolvedValue([alpha]);
    const editor = await createEditor(source);

    insertText(editor, "[[");
    await flush();

    expect(document.querySelector(".reflecta-md-editor__wiki-suggestion")?.textContent).toContain(
      "Alpha",
    );
    expect(source).toHaveBeenLastCalledWith("", expect.any(AbortSignal));

    insertText(editor, "al");
    await flush();

    expect(source).toHaveBeenLastCalledWith("al", expect.any(AbortSignal));
  });

  test("closes on ]] and does not call the source after closing", async () => {
    const source = vi.fn<WikiLinkSuggestionSource>().mockResolvedValue([alpha]);
    const editor = await createEditor(source);

    insertText(editor, "[[al");
    await flush();
    expect(source).toHaveBeenCalled();

    insertText(editor, "]]");
    await flush();

    const callCount = source.mock.calls.length;
    expect(document.querySelector(".reflecta-md-editor__wiki-suggestion")?.textContent).toBe("");
    insertText(editor, "pha");
    await flush();
    expect(source).toHaveBeenCalledTimes(callCount);
  });

  test("dismisses on Escape without reopening in the same trigger range", async () => {
    const source = vi.fn<WikiLinkSuggestionSource>().mockResolvedValue([alpha]);
    const editor = await createEditor(source);

    insertText(editor, "[[al");
    await flush();
    expect(pressKey(editor, "Escape")).toBe(true);
    await flush();

    const callCount = source.mock.calls.length;
    insertText(editor, "p");
    await flush();
    expect(source).toHaveBeenCalledTimes(callCount);

    insertText(editor, " [[be");
    await flush();
    expect(source).toHaveBeenCalledWith("be", expect.any(AbortSignal));
  });

  test("Arrow keys clamp selection and Enter inserts the selected markdown", async () => {
    let resolveFirst: (items: WikiLinkSuggestionItem[]) => void = () => undefined;
    const source = vi
      .fn<WikiLinkSuggestionSource>()
      .mockImplementationOnce(
        () =>
          new Promise<WikiLinkSuggestionItem[]>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue([alpha]);
    const editor = await createEditor(source);

    insertText(editor, "[[");
    await flush();
    expect(document.querySelector(".reflecta-md-editor__wiki-suggestion")?.textContent).toContain(
      "搜索中",
    );

    resolveFirst([alpha, beta]);
    await flush();
    expect(pressKey(editor, "ArrowDown")).toBe(true);
    expect(
      document.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.textContent,
    ).toContain("Beta");

    insertText(editor, "b");
    await flush();
    expect(
      document.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.textContent,
    ).toContain("Alpha");
    expect(pressKey(editor, "Enter")).toBe(true);

    expect(
      document.querySelector<HTMLAnchorElement>('a[data-wiki-link="thought-1"]')?.textContent,
    ).toBe("Alpha");
    expect(getMilkdownMarkdown(editor)).toContain("[[Alpha#thought-1]]");
  });

  test("ignores stale async results", async () => {
    let resolveFirst: (items: WikiLinkSuggestionItem[]) => void = () => undefined;
    const source = vi
      .fn<WikiLinkSuggestionSource>()
      .mockImplementationOnce(
        () =>
          new Promise<WikiLinkSuggestionItem[]>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([beta]);
    const editor = await createEditor(source);

    insertText(editor, "[[a");
    await flush();
    insertText(editor, "b");
    await flush();
    resolveFirst([alpha]);
    await flush();

    expect(document.querySelector(".reflecta-md-editor__wiki-suggestion")?.textContent).toContain(
      "Beta",
    );
    expect(
      document.querySelector(".reflecta-md-editor__wiki-suggestion")?.textContent,
    ).not.toContain("Alpha");
  });

  test("click and Enter insert the same markdown", async () => {
    const source = vi.fn<WikiLinkSuggestionSource>().mockResolvedValue([alpha]);
    const editor = await createEditor(source);

    insertText(editor, "[[");
    await flush();
    document.querySelector<HTMLButtonElement>('[role="option"]')?.click();
    expect(
      document.querySelector<HTMLAnchorElement>('a[data-wiki-link="thought-1"]')?.textContent,
    ).toBe("Alpha");
    expect(getMilkdownMarkdown(editor)).toContain("[[Alpha#thought-1]]");

    const otherEditor = await createEditor(source);
    insertText(otherEditor, "[[");
    await flush();
    expect(pressKey(otherEditor, "Enter")).toBe(true);
    expect(
      document.querySelectorAll<HTMLAnchorElement>('a[data-wiki-link="thought-1"]').item(1)
        ?.textContent,
    ).toBe("Alpha");
    expect(getMilkdownMarkdown(otherEditor)).toContain("[[Alpha#thought-1]]");
  });

  test("does not mount in readonly editors", async () => {
    const source = vi.fn<WikiLinkSuggestionSource>().mockResolvedValue([alpha]);
    const editor = await createEditor(source, true);

    insertText(editor, "[[");
    await flush();

    expect(source).not.toHaveBeenCalled();
    expect(document.querySelector(".reflecta-md-editor__wiki-suggestion")).toBeNull();
  });
});
