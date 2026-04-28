import { ipcClient } from "@renderer/utils/ipc";
import { defineComponent, onMounted, onUnmounted, ref, watch } from "vue";
import Vditor from "vditor";

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

export const MarkdownEditor = defineComponent({
  name: "MarkdownEditor",
  props: {
    content: { type: String, default: undefined },
    width: { type: [Number, String], default: "100%" },
    height: { type: [Number, String], default: 400 },
  },
  emits: ["update"],
  setup(props, { emit }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    const vditorRef = ref<Vditor | null>(null);

    onMounted(() => {
      if (!containerRef.value) return;

      const vditor = new Vditor(containerRef.value, {
        width: props.width ?? "100%",
        height: props.height ?? 400,
        cache: { enable: false },
        toolbar: [],
        fullscreen: { index: 1000 },
        placeholder: "请输入",
        preview: {
          hljs: { style: "catppuccin-latte" },
          markdown: { mark: true, sanitize: false },
          theme: { current: "ant-design" },
        },
        upload: {
          multiple: false,
          accept: "image/*, video/*, audio/*",
          handler: (files: File[]) => {
            (async () => {
              for (const file of files) {
                const base64 = await fileToBase64(file);
                const id = await ipcClient.asset.saveAsset(base64, file.name);
                const url = `asset:///${id}`;
                if (file.type.startsWith("image/")) {
                  vditorRef.value?.insertValue(`![](${url})\n`);
                } else if (file.type.startsWith("video/")) {
                  vditorRef.value?.insertValue(
                    `<video src="${url}" controls style="max-width:100%"></video>\n`,
                  );
                } else if (file.type.startsWith("audio/")) {
                  vditorRef.value?.insertValue(`<audio src="${url}" controls></audio>\n`);
                }
              }
            })();
            return null;
          },
        },
        input: (value) => {
          emit("update", value);
        },
        after: () => {
          vditorRef.value = vditor;
          if (props.content !== undefined) {
            vditor.setValue(props.content);
          }
        },
        mode: "ir",
      });
    });

    onUnmounted(() => {
      if (vditorRef.value) {
        vditorRef.value.destroy();
        vditorRef.value = null;
      }
    });

    watch(
      () => props.content,
      (val) => {
        if (!vditorRef.value || val === undefined) return;
        if (vditorRef.value.getValue() !== val) {
          vditorRef.value.setValue(val);
        }
      },
    );

    return () => (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: typeof props.height === "number" ? `${props.height}px` : props.height,
        }}
      />
    );
  },
});
