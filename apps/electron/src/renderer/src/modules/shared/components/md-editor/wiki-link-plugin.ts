import type { EditorView } from "@milkdown/prose/view";
import type { EditorState, Transaction } from "@milkdown/prose/state";
import { Plugin, PluginKey } from "@milkdown/prose/state";
import { $prose } from "@milkdown/utils";

export type WikiLinkMenuState =
  | {
      active: false;
    }
  | {
      active: true;
      from: number;
      to: number;
      query: string;
      selectedIndex: number;
    };

export type WikiLinkPluginController = {
  getItemCount?: (state: WikiLinkMenuState) => number;
  getSelectedMarkdown?: (state: Extract<WikiLinkMenuState, { active: true }>) => string | null;
  onStateChange?: (state: WikiLinkMenuState) => void;
  onSelect?: (state: Extract<WikiLinkMenuState, { active: true }>, markdown: string) => void;
};

type WikiLinkPluginMeta =
  | { type: "close" }
  | { type: "setSelectedIndex"; selectedIndex: number };

export const wikiLinkPluginKey = new PluginKey<WikiLinkMenuState>("reflecta-wiki-link");

const inactiveState: WikiLinkMenuState = { active: false };

function statesEqual(left: WikiLinkMenuState, right: WikiLinkMenuState): boolean {
  if (!left.active || !right.active) return left.active === right.active;
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.query === right.query &&
    left.selectedIndex === right.selectedIndex
  );
}

export function findWikiLinkMenuState(
  state: EditorState,
  previous: WikiLinkMenuState = inactiveState,
): WikiLinkMenuState {
  const selection = state.selection;
  if (!selection.empty) return inactiveState;
  if (!selection.$from.parent.isTextblock) return inactiveState;

  const textBeforeCursor = selection.$from.parent.textBetween(
    0,
    selection.$from.parentOffset,
    "\n",
    "\n",
  );
  const triggerOffset = textBeforeCursor.lastIndexOf("[[");
  if (triggerOffset < 0) return inactiveState;

  const query = textBeforeCursor.slice(triggerOffset + 2);
  if (query.includes("]") || query.includes("\n")) return inactiveState;

  const from = selection.$from.start() + triggerOffset;
  const selectedIndex =
    previous.active && previous.from === from && previous.query === query
      ? previous.selectedIndex
      : 0;

  return {
    active: true,
    from,
    to: selection.from,
    query,
    selectedIndex,
  };
}

function applyWikiLinkMeta(
  meta: WikiLinkPluginMeta | undefined,
  previous: WikiLinkMenuState,
): WikiLinkMenuState | null {
  if (!meta) return null;
  if (meta.type === "close") return inactiveState;
  if (!previous.active) return previous;

  return {
    ...previous,
    selectedIndex: Math.max(0, meta.selectedIndex),
  };
}

function applyWikiLinkState(
  transaction: Transaction,
  previous: WikiLinkMenuState,
  _oldState: EditorState,
  nextState: EditorState,
): WikiLinkMenuState {
  const meta = applyWikiLinkMeta(transaction.getMeta(wikiLinkPluginKey), previous);
  if (meta) return meta;
  if (!transaction.docChanged && !transaction.selectionSet) return previous;
  return findWikiLinkMenuState(nextState, previous);
}

export function insertWikiLinkMarkdown(
  view: EditorView,
  state: Extract<WikiLinkMenuState, { active: true }>,
  markdown: string,
): void {
  const text = view.state.schema.text(markdown);
  const transaction = view.state.tr
    .replaceWith(state.from, state.to, text)
    .setMeta(wikiLinkPluginKey, { type: "close" } satisfies WikiLinkPluginMeta)
    .scrollIntoView();
  view.dispatch(transaction);
  view.focus();
}

function getItemCount(
  controller: WikiLinkPluginController,
  state: WikiLinkMenuState,
): number {
  return Math.max(0, controller.getItemCount?.(state) ?? 0);
}

function emitState(
  controller: WikiLinkPluginController,
  state: WikiLinkMenuState,
): void {
  controller.onStateChange?.(state);
}

export function createWikiLinkProsePlugin(controller: WikiLinkPluginController = {}) {
  return new Plugin<WikiLinkMenuState>({
    key: wikiLinkPluginKey,
    state: {
      init: (_config, state) => findWikiLinkMenuState(state),
      apply: applyWikiLinkState,
    },
    view: (view) => {
      let previous = wikiLinkPluginKey.getState(view.state) ?? inactiveState;
      emitState(controller, previous);

      return {
        update: (nextView) => {
          const next = wikiLinkPluginKey.getState(nextView.state) ?? inactiveState;
          if (statesEqual(previous, next)) return;
          previous = next;
          emitState(controller, next);
        },
      };
    },
    props: {
      handleKeyDown: (view, event) => {
        const current = wikiLinkPluginKey.getState(view.state);
        if (!current?.active) return false;

        if (event.key === "Escape") {
          event.preventDefault();
          view.dispatch(
            view.state.tr.setMeta(wikiLinkPluginKey, {
              type: "close",
            } satisfies WikiLinkPluginMeta),
          );
          return true;
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const itemCount = getItemCount(controller, current);
          const total = Math.max(1, itemCount);
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const selectedIndex = (current.selectedIndex + delta + total) % total;
          view.dispatch(
            view.state.tr.setMeta(wikiLinkPluginKey, {
              type: "setSelectedIndex",
              selectedIndex,
            } satisfies WikiLinkPluginMeta),
          );
          return true;
        }

        if (event.key === "Enter") {
          const itemCount = getItemCount(controller, current);
          if (itemCount === 0) return false;

          const markdown = controller.getSelectedMarkdown?.(current);
          if (!markdown) return false;

          event.preventDefault();
          insertWikiLinkMarkdown(view, current, markdown);
          controller.onSelect?.(current, markdown);
          return true;
        }

        return false;
      },
    },
  });
}

export function createWikiLinkMilkdownPlugin(controller: WikiLinkPluginController = {}) {
  return $prose(() => createWikiLinkProsePlugin(controller));
}
