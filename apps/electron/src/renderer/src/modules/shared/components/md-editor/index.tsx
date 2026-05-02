import { ipcClient } from "@renderer/utils/ipc";
import { defineComponent, ref, watch, type PropType } from "vue";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/vue";
import { Crepe } from "@milkdown/crepe";
import { replaceAll } from "@milkdown/utils";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { searchEventBus } from "@renderer/utils/searchEventBus";
import {
  findThoughtWikiLinkAtOffset,
  findThoughtWikiLinkRanges,
  formatThoughtWikiLink,
  normalizeThoughtWikiLinkBody,
} from "../wiki-links";
import "@milkdown/crepe/theme/common/style.css";
import "./milkdown-theme.css";

const WIKI_HINT_LIMIT = 8;

function getSuggestionLabel(thought: ThoughtSummaryDTO): string {
  return thought.title?.trim() || thought.id;
}

async function openWikiLinkByUrl(url: string): Promise<void> {
  const id = url.trim();
  if (!id) return;
  const thought = await ipcClient.thought.resolveWikiLinkTarget(id);
  if (!thought) return;
  searchEventBus.emit("thoughtSelected", {
    thoughtId: thought.id,
    categoryIds: thought.categoryIds,
  });
}

function createWikiLinkHintPlugin() {
  return $prose(() => {
    let pluginView: WikiLinkHintView | null = null;

    const buildDecorations = (
      doc: Parameters<
        Exclude<EditorView["state"], undefined>["doc"]["descendants"]
      >[0] extends never
        ? never
        : any,
    ) => {
      const decorations: Decoration[] = [];

      doc.descendants((node: { isText?: boolean; text?: string }, pos: number) => {
        if (!node.isText || !node.text) return;

        for (const range of findThoughtWikiLinkRanges(node.text)) {
          decorations.push(
            Decoration.inline(pos + range.from, pos + range.to, {
              class: "reflecta-wiki-link",
            }),
          );
        }
      });

      return DecorationSet.create(doc, decorations);
    };

    return new Plugin({
      key: new PluginKey("reflecta-wiki-link-hint"),
      view: (view) => {
        pluginView = new WikiLinkHintView(view);
        return pluginView;
      },
      props: {
        decorations(state) {
          return buildDecorations(state.doc);
        },
        handleKeyDown(_view, event) {
          return pluginView?.handleKeyDown(event) ?? false;
        },
        handleClick(view, pos, event) {
          const mdLink = (event.target as Element | null)?.closest<HTMLAnchorElement>(
            "a[data-wiki-link]",
          );
          if (mdLink) {
            event.preventDefault();
            event.stopPropagation();
            void openWikiLinkByUrl(mdLink.dataset.wikiLink ?? "");
            return true;
          }

          const $pos = view.state.doc.resolve(pos);
          const text = $pos.parent.textBetween(0, $pos.parent.content.size, "\n", "\n");
          const link = findThoughtWikiLinkAtOffset(text, $pos.parentOffset);
          if (!link) return false;

          event.preventDefault();
          event.stopPropagation();
          void openWikiLinkByUrl(link.id);
          return true;
        },
      },
    });
  });
}

type WikiMatch = {
  from: number;
  to: number;
  query: string;
};

class WikiLinkHintView {
  private popup: HTMLDivElement;
  private suggestions: ThoughtSummaryDTO[] = [];
  private selectedIndex = 0;
  private currentMatch: WikiMatch | null = null;
  private requestSeq = 0;
  private disposed = false;

  constructor(private readonly view: EditorView) {
    this.popup = document.createElement("div");
    this.popup.className = "wiki-link-hint hidden";
    document.body.appendChild(this.popup);
    this.update(view);
  }

  update(view: EditorView): void {
    const match = this.findMatch(view);
    if (!match) {
      this.hide();
      return;
    }

    this.currentMatch = match;
    this.positionPopup(match.to);
    void this.loadSuggestions(match.query);
  }

  destroy(): void {
    this.disposed = true;
    this.popup.remove();
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    if (this.popup.classList.contains("hidden")) return false;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
      this.render();
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.render();
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      const suggestion = this.suggestions[this.selectedIndex];
      if (!suggestion) return false;
      event.preventDefault();
      this.applySuggestion(suggestion);
      return true;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.hide();
      return true;
    }

    return false;
  }

  private findMatch(view: EditorView): WikiMatch | null {
    const { selection } = view.state;
    if (!selection.empty) return null;

    const $from = selection.$from;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\n", "\n");
    const match = /@([^\s\n]*)$/.exec(textBefore);
    if (!match) return null;

    const query = match[1] ?? "";
    return {
      from: selection.from - match[0].length,
      to: selection.from,
      query: query.trim(),
    };
  }

  private async loadSuggestions(query: string): Promise<void> {
    const seq = ++this.requestSeq;
    let result: ThoughtSummaryDTO[];
    try {
      result = await ipcClient.thought.listThoughts(query ? { searchQuery: query } : undefined);
    } catch {
      result = await ipcClient.thought.listThoughts();
    }
    if (this.disposed || seq !== this.requestSeq) return;

    const normalizedQuery = query.toLocaleLowerCase();
    const suggestions = result
      .filter((thought) => {
        if (!normalizedQuery) return true;
        return (
          thought.id.toLocaleLowerCase().includes(normalizedQuery) ||
          thought.title?.toLocaleLowerCase().includes(normalizedQuery) ||
          thought.body.toLocaleLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, WIKI_HINT_LIMIT);

    this.suggestions = suggestions;
    this.selectedIndex = 0;
    this.render();
  }

  private render(): void {
    if (!this.currentMatch || this.suggestions.length === 0) {
      this.hide();
      return;
    }

    this.popup.innerHTML = "";
    this.popup.classList.remove("hidden");

    for (const [index, thought] of this.suggestions.entries()) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `wiki-link-hint__item${index === this.selectedIndex ? " is-active" : ""}`;
      item.onmousedown = (event) => {
        event.preventDefault();
        this.applySuggestion(thought);
      };

      const title = document.createElement("span");
      title.className = "wiki-link-hint__title";
      title.textContent = getSuggestionLabel(thought);
      item.appendChild(title);

      if (thought.body.trim()) {
        const body = document.createElement("span");
        body.className = "wiki-link-hint__body";
        body.textContent = thought.body.replace(/\s+/g, " ").slice(0, 72);
        item.appendChild(body);
      }

      this.popup.appendChild(item);
    }
  }

  private applySuggestion(thought: ThoughtSummaryDTO): void {
    if (!this.currentMatch) return;

    const textNode = this.view.state.schema.text(
      formatThoughtWikiLink({ title: getSuggestionLabel(thought), id: thought.id }),
    );
    const tr = this.view.state.tr.replaceWith(
      this.currentMatch.from,
      this.currentMatch.to,
      textNode,
    );
    this.view.dispatch(tr);
    this.view.focus();
    this.hide();
  }

  private positionPopup(pos: number): void {
    const coords = this.view.coordsAtPos(pos);
    this.popup.style.left = `${coords.left}px`;
    this.popup.style.top = `${coords.bottom + 6}px`;
  }

  private hide(): void {
    this.currentMatch = null;
    this.suggestions = [];
    this.popup.classList.add("hidden");
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EditorCore = defineComponent({
  name: "EditorCore",
  props: {
    content: { type: String, default: undefined },
    onUpdate: {
      type: Function as PropType<(val: string) => void>,
      required: true,
    },
    enableWikiLink: { type: Boolean, default: true },
  },
  setup(props) {
    const crepeRef = ref<Crepe | null>(null);

    const { get, loading } = useEditor((root) => {
      const crepe = new Crepe({
        root,
        defaultValue: props.content ?? "",
        featureConfigs: {
          [Crepe.Feature.CodeMirror]: {
            theme: [],
          },
          [Crepe.Feature.Placeholder]: {
            text: "请输入",
            mode: "doc",
          },
          [Crepe.Feature.ImageBlock]: {
            onUpload: async (file: File) => {
              const base64 = await fileToBase64(file);
              const id = await ipcClient.asset.saveAsset(base64, file.name);
              return `asset:///${id}`;
            },
          },
        },
      });
      crepe.editor.use(createWikiLinkHintPlugin());

      crepe.on((api) => {
        api.markdownUpdated((_ctx, markdown, _prevMarkdown) => {
          props.onUpdate(normalizeThoughtWikiLinkBody(markdown));
        });
      });

      crepeRef.value = crepe;
      return crepe;
    });

    watch(
      () => props.content,
      (val) => {
        if (val === undefined || loading.value) return;
        const crepe = crepeRef.value;
        if (!crepe) return;
        const currentMarkdown = crepe.getMarkdown();
        if (currentMarkdown === val) return;
        if (normalizeThoughtWikiLinkBody(currentMarkdown) === val) return;
        const editor = get();
        if (!editor) return;
        editor.action(replaceAll(val));
      },
    );

    return () => <Milkdown />;
  },
});

export const MarkdownEditor = defineComponent({
  name: "MarkdownEditor",
  props: {
    content: { type: String, default: undefined },
    width: { type: [Number, String], default: "100%" },
    height: { type: [Number, String], default: 400 },
    enableWikiLink: { type: Boolean, default: true },
  },
  emits: ["update"],
  setup(props, { emit }) {
    return () => (
      <div
        class="milkdown-editor"
        style={{
          width: "100%",
          height: typeof props.height === "number" ? `${props.height}px` : props.height,
        }}
      >
        <MilkdownProvider>
          <EditorCore
            content={props.content}
            enableWikiLink={props.enableWikiLink}
            onUpdate={(val: string) => emit("update", val)}
          />
        </MilkdownProvider>
      </div>
    );
  },
});
