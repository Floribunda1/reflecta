import { SlashProvider } from "@milkdown/plugin-slash";
import type { EditorState, PluginKey } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";
import type { WikiLinkSuggestionItem, WikiLinkSuggestionSource } from "./types";
import type { WikiLinkSuggestionState } from "./plugin";

type RequestKey = {
  from: number;
  query: string;
};

function sameRequestKey(a: RequestKey | null, b: RequestKey): boolean {
  return !!a && a.from === b.from && a.query === b.query;
}

function createStatus(text: string): HTMLElement {
  const status = document.createElement("div");
  status.className = "reflecta-md-editor__wiki-suggestion-status";
  status.textContent = text;
  return status;
}

export function createWikiLinkSuggestionView(
  initialView: EditorView,
  pluginKey: PluginKey<WikiLinkSuggestionState>,
  source: WikiLinkSuggestionSource,
  insertItem: (
    view: EditorView,
    state: WikiLinkSuggestionState,
    item: WikiLinkSuggestionItem,
  ) => void,
): {
  update: (nextView: EditorView, prevState?: EditorState) => void;
  destroy: () => void;
} {
  let view = initialView;
  let abortController: AbortController | null = null;
  let lastRequestKey: RequestKey | null = null;
  let requestId = 0;

  const content = document.createElement("div");
  content.className = "reflecta-md-editor__wiki-suggestion";
  content.dataset.show = "false";
  content.setAttribute("role", "listbox");
  content.setAttribute("aria-label", "Wiki Link suggestions");

  const provider = new SlashProvider({
    content,
    debounce: 0,
    offset: 8,
    root: view.dom.parentElement ?? undefined,
    shouldShow: (editorView) => pluginKey.getState(editorView.state)?.active ?? false,
    floatingUIOptions: {
      placement: "bottom-start",
      strategy: "fixed",
    },
  });

  function dispatchMeta(meta: unknown): void {
    view.dispatch(view.state.tr.setMeta(pluginKey, meta));
  }

  function startRequest(state: WikiLinkSuggestionState): void {
    const nextRequestKey = { from: state.from, query: state.query };
    if (sameRequestKey(lastRequestKey, nextRequestKey)) return;

    lastRequestKey = nextRequestKey;
    abortController?.abort();
    abortController = new AbortController();
    requestId += 1;
    const currentRequestId = requestId;

    dispatchMeta({ type: "loading", requestId: currentRequestId });

    source(state.query, abortController.signal)
      .then((items) => {
        if (abortController?.signal.aborted) return;
        dispatchMeta({ type: "results", requestId: currentRequestId, items });
      })
      .catch(() => {
        if (abortController?.signal.aborted) return;
        dispatchMeta({ type: "error", requestId: currentRequestId });
      });
  }

  function selectItem(item: WikiLinkSuggestionItem): void {
    const state = pluginKey.getState(view.state);
    if (!state?.active) return;
    insertItem(view, state, item);
  }

  function render(state: WikiLinkSuggestionState | undefined): void {
    content.replaceChildren();
    if (!state?.active) return;

    if (state.loading) {
      content.append(createStatus("搜索中..."));
      return;
    }

    if (state.items.length === 0) {
      content.append(createStatus("没有匹配的理解"));
      return;
    }

    state.items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reflecta-md-editor__wiki-suggestion-item";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(index === state.selectedIndex));
      button.textContent = item.title;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => selectItem(item));
      content.append(button);
    });
  }

  return {
    update(nextView, prevState) {
      view = nextView;
      const state = pluginKey.getState(view.state);

      if (!state?.active) {
        abortController?.abort();
        abortController = null;
        lastRequestKey = null;
        render(state);
        provider.update(view, prevState);
        return;
      }

      startRequest(state);
      render(pluginKey.getState(view.state));
      provider.update(view, prevState);
    },

    destroy() {
      abortController?.abort();
      provider.destroy();
      content.remove();
    },
  };
}
