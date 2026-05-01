import { defineComponent, onMounted, ref, watch } from "vue";
import { marked } from "marked";
import mediumZoom from "medium-zoom";
import "./style.css";

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
      el.innerHTML = marked.parse(truncatedContent, { async: false }) as string;
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
      mediumZoom(el.querySelectorAll("img"));
    };

    onMounted(render);
    watch(() => props.content, render);

    return () => <div ref={containerRef} class="markdown-preview" />;
  },
});
