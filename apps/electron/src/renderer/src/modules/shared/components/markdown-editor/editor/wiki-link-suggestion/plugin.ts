import { $prose } from "@milkdown/utils";
import type { EditorState, Transaction } from "@milkdown/prose/state";
import { Plugin, PluginKey } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";
import { createWikiLinkSuggestionView } from "./view";
import type { WikiLinkSuggestionItem, WikiLinkSuggestionOptions } from "./types";

export type WikiLinkSuggestionState = {
  active: boolean;
  from: number;
  to: number;
  query: string;
  selectedIndex: number;
  items: WikiLinkSuggestionItem[];
  loading: boolean;
  requestId: number;
  dismissedFrom: number | null;
};

type WikiLinkSuggestionMeta =
  | { type: "loading"; requestId: number }
  | { type: "results"; requestId: number; items: WikiLinkSuggestionItem[] }
  | { type: "error"; requestId: number }
  | { type: "select"; selectedIndex: number }
  | { type: "close"; dismiss?: boolean };

export const wikiLinkSuggestionPluginKey = new PluginKey<WikiLinkSuggestionState>(
  "reflecta-wiki-link-suggestion",
);

const inactiveState: WikiLinkSuggestionState = {
  active: false,
  from: 0,
  to: 0,
  query: "",
  selectedIndex: 0,
  items: [],
  loading: false,
  requestId: 0,
  dismissedFrom: null,
};

function clampSelectedIndex(selectedIndex: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(selectedIndex, itemCount - 1));
}

function closeState(
  previous: WikiLinkSuggestionState,
  dismissedFrom: number | null = null,
): WikiLinkSuggestionState {
  return {
    ...inactiveState,
    requestId: previous.requestId,
    dismissedFrom,
  };
}

function textblockMatch(
  state: EditorState,
): Pick<WikiLinkSuggestionState, "active" | "from" | "to" | "query"> | null {
  const { selection } = state;
  if (!selection.empty) return null;

  const $cursor = selection.$from;
  if (!$cursor.parent.isTextblock) return null;

  const textBeforeCursor = $cursor.parent.textBetween(0, $cursor.parentOffset, "\n", "\n");
  const triggerIndex = textBeforeCursor.lastIndexOf("[[");
  if (triggerIndex === -1) return null;

  const query = textBeforeCursor.slice(triggerIndex + 2);
  if (query.includes("]") || query.includes("\n")) return null;

  return {
    active: true,
    from: $cursor.start() + triggerIndex,
    to: selection.from,
    query,
  };
}

function applyMeta(
  previous: WikiLinkSuggestionState,
  transaction: Transaction,
): WikiLinkSuggestionState | null {
  const meta = transaction.getMeta(wikiLinkSuggestionPluginKey) as
    | WikiLinkSuggestionMeta
    | undefined;
  if (!meta) return null;

  if (meta.type === "close") {
    return closeState(previous, meta.dismiss && previous.active ? previous.from : null);
  }

  if (!previous.active) return previous;

  if (meta.type === "loading") {
    return {
      ...previous,
      loading: true,
      requestId: meta.requestId,
    };
  }

  if (meta.type === "results" && meta.requestId === previous.requestId) {
    return {
      ...previous,
      loading: false,
      items: meta.items,
      selectedIndex: clampSelectedIndex(previous.selectedIndex, meta.items.length),
    };
  }

  if (meta.type === "error" && meta.requestId === previous.requestId) {
    return {
      ...previous,
      loading: false,
      items: [],
      selectedIndex: 0,
    };
  }

  if (meta.type === "select") {
    return {
      ...previous,
      selectedIndex: clampSelectedIndex(meta.selectedIndex, previous.items.length),
    };
  }

  return previous;
}

function applyDocumentState(
  previous: WikiLinkSuggestionState,
  state: EditorState,
): WikiLinkSuggestionState {
  const match = textblockMatch(state);
  if (!match) return closeState(previous, null);

  if (previous.dismissedFrom === match.from) {
    return closeState(previous, match.from);
  }

  if (previous.active && previous.from === match.from && previous.query === match.query) {
    return {
      ...previous,
      to: match.to,
      selectedIndex: clampSelectedIndex(previous.selectedIndex, previous.items.length),
    };
  }

  return {
    ...inactiveState,
    ...match,
    requestId: previous.requestId,
    dismissedFrom: null,
  };
}

export function insertWikiLinkSuggestion(
  view: EditorView,
  state: WikiLinkSuggestionState,
  item: WikiLinkSuggestionItem,
): void {
  const wikiLinkNode = view.state.schema.nodes.wiki_link?.create({
    title: item.title,
    id: item.id,
  });
  const transaction = (
    wikiLinkNode
      ? view.state.tr.replaceWith(state.from, state.to, wikiLinkNode)
      : view.state.tr.insertText(item.markdown, state.from, state.to)
  )
    .setMeta(wikiLinkSuggestionPluginKey, {
      type: "close" satisfies WikiLinkSuggestionMeta["type"],
    })
    .scrollIntoView();
  view.dispatch(transaction);
  view.focus();
}

function handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
  const state = wikiLinkSuggestionPluginKey.getState(view.state);
  if (!state?.active) return false;

  if (event.key === "Escape") {
    view.dispatch(
      view.state.tr.setMeta(wikiLinkSuggestionPluginKey, {
        type: "close",
        dismiss: true,
      } satisfies WikiLinkSuggestionMeta),
    );
    event.preventDefault();
    return true;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const itemCount = state.items.length;
    const selectedIndex =
      itemCount <= 0 ? 0 : (state.selectedIndex + direction + itemCount) % itemCount;

    view.dispatch(
      view.state.tr.setMeta(wikiLinkSuggestionPluginKey, {
        type: "select",
        selectedIndex,
      } satisfies WikiLinkSuggestionMeta),
    );
    event.preventDefault();
    return true;
  }

  if (event.key === "Enter") {
    const item = state.items[clampSelectedIndex(state.selectedIndex, state.items.length)];
    if (!item) return false;

    insertWikiLinkSuggestion(view, state, item);
    event.preventDefault();
    return true;
  }

  return false;
}

function createWikiLinkSuggestionProsePlugin(options: WikiLinkSuggestionOptions): Plugin {
  return new Plugin<WikiLinkSuggestionState>({
    key: wikiLinkSuggestionPluginKey,
    state: {
      init: () => inactiveState,
      apply: (transaction, previous, _oldState, newState) => {
        const withMeta = applyMeta(previous, transaction);
        if (withMeta) return withMeta;
        if (!transaction.docChanged && !transaction.selectionSet) return previous;
        return applyDocumentState(previous, newState);
      },
    },
    props: {
      handleKeyDown,
    },
    view: (view) =>
      createWikiLinkSuggestionView(
        view,
        wikiLinkSuggestionPluginKey,
        options.source,
        insertWikiLinkSuggestion,
      ),
  });
}

export function createWikiLinkSuggestionPlugin(options: WikiLinkSuggestionOptions) {
  return $prose(() => createWikiLinkSuggestionProsePlugin(options));
}
