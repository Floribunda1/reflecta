import { SlashProvider } from "@milkdown/plugin-slash";
import type { EditorState, PluginKey } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";
import type { WikiLinkSuggestionItem, WikiLinkSuggestionSource } from "./types";
import type { WikiLinkSuggestionState } from "./plugin";

type RequestKey = {
  from: number;
  query: string;
};

const requestDebounceMs = 160;

function sameRequestKey(a: RequestKey | null, b: RequestKey): boolean {
  return !!a && a.from === b.from && a.query === b.query;
}

function createStatus(text: string): HTMLElement {
  const status = document.createElement("div");
  status.className = "reflecta-md-editor__wiki-suggestion-status";
  status.textContent = text;
  return status;
}

function scrollSelectedItemIntoView(content: HTMLElement): void {
  content
    .querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
    ?.scrollIntoView({ block: "nearest" });
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
  let requestTimer: ReturnType<typeof setTimeout> | null = null;
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

  function clearRequestTimer(): void {
    if (!requestTimer) return;
    clearTimeout(requestTimer);
    requestTimer = null;
  }

  function startRequest(state: WikiLinkSuggestionState): void {
    const nextRequestKey = { from: state.from, query: state.query };
    if (sameRequestKey(lastRequestKey, nextRequestKey)) return;

    lastRequestKey = nextRequestKey;
    clearRequestTimer();
    abortController?.abort();
    abortController = new AbortController();
    const controller = abortController;
    requestId += 1;
    const currentRequestId = requestId;

    dispatchMeta({ type: "loading", requestId: currentRequestId });

    requestTimer = setTimeout(() => {
      requestTimer = null;
      source(state.query, controller.signal)
        .then((items) => {
          if (controller.signal.aborted) return;
          dispatchMeta({ type: "results", requestId: currentRequestId, items });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          dispatchMeta({ type: "error", requestId: currentRequestId });
        });
    }, requestDebounceMs);
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

      const title = document.createElement("div");
      title.className = "reflecta-md-editor__wiki-suggestion-title";
      title.textContent = item.title;
      button.append(title);

      if (item.preview) {
        const preview = document.createElement("div");
        preview.className = "reflecta-md-editor__wiki-suggestion-preview";
        preview.textContent = item.preview;
        button.append(preview);
      }

      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => selectItem(item));
      content.append(button);
    });

    scrollSelectedItemIntoView(content);
  }

  return {
    update(nextView, prevState) {
      view = nextView;
      const state = pluginKey.getState(view.state);

      if (!state?.active) {
        clearRequestTimer();
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
      clearRequestTimer();
      abortController?.abort();
      provider.destroy();
      content.remove();
    },
  };
}
