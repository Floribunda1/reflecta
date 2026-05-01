import { ipcClient } from "@renderer/utils/ipc";
import { defineComponent, ref, watch, type PropType } from "vue";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/vue";
import { Crepe } from "@milkdown/crepe";
import { replaceAll } from "@milkdown/utils";
import "@milkdown/crepe/theme/common/style.css";
import "./milkdown-theme.css";

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

      crepe.on((api) => {
        api.markdownUpdated((_ctx, markdown, _prevMarkdown) => {
          props.onUpdate(markdown);
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
        if (crepe.getMarkdown() === val) return;
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
          <EditorCore content={props.content} onUpdate={(val: string) => emit("update", val)} />
        </MilkdownProvider>
      </div>
    );
  },
});
