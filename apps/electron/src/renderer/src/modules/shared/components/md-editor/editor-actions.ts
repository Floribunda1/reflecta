import type { Editor } from "@milkdown/core";
import { editorViewCtx, parserCtx } from "@milkdown/core";

export type TriggerMatch = {
  fromOffset: number;
  query: string;
};

export function findWikiLinkTrigger(textBeforeCursor: string): TriggerMatch | null {
  const start = textBeforeCursor.lastIndexOf("[[");
  if (start < 0) return null;

  const query = textBeforeCursor.slice(start + 2);
  if (query.includes("]") || query.includes("\n")) return null;

  return { fromOffset: start, query };
}

export function getTextBeforeCursor(editor: Editor): string {
  const view = editor.ctx.get(editorViewCtx);
  const selection = view.state.selection;
  if (!selection.empty) return "";
  return selection.$from.parent.textBetween(0, selection.$from.parentOffset, "\n", "\n");
}

export function insertMarkdownReplacingTrigger(
  editor: Editor,
  input: { fromOffset: number; markdown: string },
): void {
  const parser = editor.ctx.get(parserCtx);
  const view = editor.ctx.get(editorViewCtx);
  const selection = view.state.selection;
  const paragraphStart = selection.$from.start();
  const from = paragraphStart + input.fromOffset;
  const inserted = input.markdown.startsWith("[[")
    ? view.state.schema.text(input.markdown)
    : parser(input.markdown).content;
  const transaction = view.state.tr.replaceWith(from, selection.from, inserted).scrollIntoView();
  view.dispatch(transaction);
  view.focus();
}
