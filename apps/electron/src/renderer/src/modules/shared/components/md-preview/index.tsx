import { defineComponent, onMounted, ref, watch } from "vue";
import { marked } from "marked";
import mediumZoom from "medium-zoom";
import { ipcClient } from "@renderer/utils/ipc";
import { searchEventBus } from "@renderer/utils/searchEventBus";
import "./style.css";

async function handleWikiLinkClick(e: MouseEvent): Promise<void> {
  const el = e.target as Element | null;
  const link = el?.closest<HTMLAnchorElement>("a[data-wiki-link]");
  if (!link) return;

  e.preventDefault();
  e.stopPropagation();

  const target = link.dataset.wikiLink;
  if (!target) return;

  const thought = await ipcClient.thought.resolveWikiLinkTarget(target);
  if (!thought) return;

  searchEventBus.emit("thoughtSelected", {
    thoughtId: thought.id,
    categoryIds: thought.categoryIds,
  });
}

function bindWikiLinkClicks(container: HTMLDivElement): void {
  for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href^="/wiki/"]')) {
    link.dataset.wikiLink = decodeURIComponent(link.getAttribute("href")!.replace(/^\/wiki\//, ""));
    link.setAttribute("href", "#");
    link.classList.add("wiki-link");
  }
}

export const SimpleMarkdownPreview = defineComponent({
  name: "SimpleMarkdownPreview",
  props: {
    content: { type: String, required: true },
    lineClamp: { type: Number, default: undefined },
  },
  setup(props) {
    const containerRef = ref<HTMLDivElement | null>(null);

    const render = () => {
      const el = containerRef.value;
      if (!el) return;
      el.innerHTML = "";
      if (!props.content) return;
      const truncatedContent = props.content
        .split("\n")
        .filter(Boolean)
        .slice(0, props.lineClamp)
        .join("\n");
      el.innerHTML = marked.parse(truncatedContent, {
        async: false,
      }) as string;
      bindWikiLinkClicks(el);
    };

    onMounted(render);
    watch(() => props.content, render);

    return () => (
      <div
        ref={containerRef}
        style={{
          maxHeight: props.lineClamp != null ? `${props.lineClamp * 1.5}em` : undefined,
          overflow: props.lineClamp != null ? "hidden" : undefined,
        }}
        class="markdown-preview markdown-preview-compact"
        onClick={handleWikiLinkClick}
      />
    );
  },
});

export const MarkdownPreview = defineComponent({
  name: "MarkdownPreview",
  props: {
    content: { type: String, required: true },
  },
  setup(props) {
    const containerRef = ref<HTMLDivElement | null>(null);

    const render = () => {
      const el = containerRef.value;
      if (!el) return;
      el.innerHTML = "";
      if (!props.content) return;
      el.innerHTML = marked.parse(props.content, { async: false }) as string;
      bindWikiLinkClicks(el);
      mediumZoom(el.querySelectorAll("img"));
    };

    onMounted(render);
    watch(() => props.content, render);

    return () => <div ref={containerRef} class="markdown-preview" onClick={handleWikiLinkClick} />;
  },
});
