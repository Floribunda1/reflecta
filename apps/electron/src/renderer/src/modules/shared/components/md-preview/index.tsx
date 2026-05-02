import { defineComponent, onMounted, ref, watch } from "vue";
import mediumZoom from "medium-zoom";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { ipcClient } from "@renderer/utils/ipc";
import { searchEventBus } from "@renderer/utils/searchEventBus";
import { renderThoughtWikiLinksAsHtml } from "../wiki-links";
import "./style.css";

const markdownRenderer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

function renderMarkdownToHtml(content: string): string {
  return String(markdownRenderer.processSync(content));
}

async function handleWikiLinkClick(e: MouseEvent): Promise<void> {
  const el = e.target as Element | null;
  const link = el?.closest<HTMLAnchorElement>("a[data-wiki-link]");
  if (!link) return;

  e.preventDefault();
  e.stopPropagation();

  const target = link.dataset.wikiLink;
  if (!target) return;

  const id = target.replace(/^\/wiki\//, "").trim();
  if (!id) return;
  const thought = await ipcClient.thought.getThoughtById(id);
  if (!thought) return;

  searchEventBus.emit("thoughtSelected", {
    thoughtId: thought.id,
    categoryIds: thought.categoryIds,
  });
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
      el.innerHTML = renderMarkdownToHtml(renderThoughtWikiLinksAsHtml(truncatedContent));
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
      el.innerHTML = renderMarkdownToHtml(renderThoughtWikiLinksAsHtml(props.content));
      mediumZoom(el.querySelectorAll("img"));
    };

    onMounted(render);
    watch(() => props.content, render);

    return () => <div ref={containerRef} class="markdown-preview" onClick={handleWikiLinkClick} />;
  },
});
