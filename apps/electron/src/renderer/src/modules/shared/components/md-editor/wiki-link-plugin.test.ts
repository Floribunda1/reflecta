// @vitest-environment happy-dom

import { afterEach, describe, expect, test } from "vitest";
import { editorViewCtx } from "@milkdown/core";
import type { Editor } from "@milkdown/core";
import { TextSelection } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";
import {
  createReflectaMilkdownEditor,
  getMilkdownMarkdown,
} from "./milkdown-editor";

const editors: Editor[] = [];

afterEach(async () => {
  await Promise.all(editors.map((editor) => editor.destroy()));
  editors.length = 0;
});

function pressKey(view: EditorView, key: string): boolean {
  const event = new KeyboardEvent("keydown", { key, cancelable: true });
  let handled = false;

  view.someProp("handleKeyDown", (handler) => {
    if (handled) return true;
    handled = handler(view, event) === true;
    return handled;
  });

  return handled;
}

describe("wiki link plugin", () => {
  test("opens on a wiki trigger, navigates with keyboard, and inserts the selected link", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const states: Array<{ active: boolean; query?: string; selectedIndex?: number }> = [];

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "Connect ",
      wikiLinkController: {
        getItemCount: () => 2,
        getSelectedMarkdown: (state) =>
          state.selectedIndex === 1 ? "[[Beta#thought-2]]" : "[[Alpha#thought-1]]",
        onStateChange: (state) => states.push(state),
      },
    });
    editors.push(editor);

    const view = editor.ctx.get(editorViewCtx);
    view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
    view.dispatch(view.state.tr.insertText("[["));

    expect(states.at(-1)).toMatchObject({
      active: true,
      query: "",
      selectedIndex: 0,
    });

    expect(pressKey(view, "ArrowUp")).toBe(true);
    expect(states.at(-1)).toMatchObject({
      active: true,
      selectedIndex: 1,
    });

    expect(pressKey(view, "ArrowDown")).toBe(true);
    expect(states.at(-1)).toMatchObject({
      active: true,
      selectedIndex: 0,
    });

    expect(pressKey(view, "ArrowDown")).toBe(true);
    expect(states.at(-1)).toMatchObject({
      active: true,
      selectedIndex: 1,
    });

    expect(pressKey(view, "Enter")).toBe(true);
    expect(getMilkdownMarkdown(editor)).toContain("[[Beta#thought-2]]");
    expect(states.at(-1)).toMatchObject({ active: false });
  });
});
