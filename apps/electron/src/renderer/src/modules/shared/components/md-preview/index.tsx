import { defineComponent, onMounted, ref, watch } from "vue";
import { marked } from "marked";
import Vditor from "vditor";
import mediumZoom from "medium-zoom";
import { css } from "@emotion/css";

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
          fontSize: "13px",
          lineHeight: "1.5em",
          maxHeight: props.lineClamp != null ? `${props.lineClamp * 1.5}em` : undefined,
          overflow: props.lineClamp !== null ? "hidden" : undefined,
        }}
        class={[
          "text-surface-500",
          css`
            & p {
              white-space: pre-line;
            }
          `,
        ]}
      />
    );
  },
});

export const VditorMarkdownPreview = defineComponent({
  name: "VditorMarkdownPreview",
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
      Vditor.preview(el, props.content, {
        mode: "light",
        theme: { current: "ant-design" },
        hljs: { style: "github" },
        after: () => mediumZoom(el.querySelectorAll("img")),
      });
    };

    onMounted(render);
    watch(() => props.content, render);

    return () => <div ref={containerRef} style={{ fontSize: "13px" }} />;
  },
});
