import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "#components/button";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { fullMarkdownStoryDocument, markdownBoundaryDocument } from "./markdown-story-fixtures";
import { MarkdownEditor, type MarkdownEditorProps, type MarkdownEditorSuggestionSource } from ".";

const suggestions = [
  {
    id: "understanding-irrigation",
    label: "分区灌溉策略",
    preview: "不同种植槽根据含水率和回水温度获得独立灌溉窗口。",
    markdown: "[[分区灌溉策略#understanding-irrigation]]",
  },
  {
    id: "context-night-shift",
    label: "夜班联调记录",
    preview: "记录低温环境中的阀门启动顺序和现场复核结果。",
    markdown: "[[夜班联调记录#context-night-shift]]",
  },
  {
    id: "domain-facility",
    label: "设施工程",
    preview: "温室控制、灌溉和设备维护相关的领域。",
    markdown: "[[设施工程#domain-facility]]",
  },
] as const;

const getSuggestions: MarkdownEditorSuggestionSource = async (query, signal) => {
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  if (signal.aborted) return [];
  if (query.includes("错误")) throw new Error("模拟联想加载失败");
  if (query.includes("空")) return [];

  const normalized = query.trim().toLocaleLowerCase();
  return normalized
    ? suggestions.filter((item) => item.label.toLocaleLowerCase().includes(normalized))
    : suggestions;
};

function ControlledEditor(
  props: Omit<MarkdownEditorProps, "value" | "onChange"> & { initialValue: string },
) {
  const { initialValue, ...editorProps } = props;
  const [value, setValue] = useState(initialValue);
  return <MarkdownEditor {...editorProps} value={value} onChange={setValue} />;
}

function CompleteEditorDemo() {
  const [openedLink, setOpenedLink] = useState("尚未打开 Wiki Link");
  return (
    <div className="grid gap-3">
      <ControlledEditor
        documentId="editor-complete"
        initialValue={fullMarkdownStoryDocument}
        height={560}
        getSuggestions={getSuggestions}
        uploadAsset={async (file) => ({ url: URL.createObjectURL(file), alt: file.name })}
        onWikiLinkOpen={(id) => setOpenedLink(`已打开：${id}`)}
      />
      <p className="text-xs text-muted-foreground">{openedLink}</p>
    </div>
  );
}

function SuggestionAndUploadDemo() {
  const [message, setMessage] = useState(
    "输入 [[ 查看候选；继续输入“空”或“错误”验收空结果与失败状态。",
  );
  return (
    <div className="grid max-w-4xl gap-3">
      <ControlledEditor
        documentId="editor-suggestion-upload"
        initialValue="## Wiki Link 与上传\n\n在这里继续输入："
        height={300}
        getSuggestions={getSuggestions}
        uploadAsset={async (file) => {
          if (file.name.includes("失败")) {
            setMessage(`上传失败：${file.name}`);
            throw new Error("模拟上传失败");
          }
          setMessage(`上传完成：${file.name}`);
          return { url: URL.createObjectURL(file), alt: file.name };
        }}
      />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function ExternalUpdateDemo() {
  const documents = [
    { id: "editor-controlled-a", value: "# 第一份文档\n\n可以在这里继续编辑。" },
    { id: "editor-controlled-b", value: "# 第二份文档\n\n切换后应同步外部内容。" },
  ] as const;
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState<string>(documents[0].value);

  const switchDocument = () => {
    const next = (index + 1) % documents.length;
    setIndex(next);
    setValue(documents[next].value);
  };

  return (
    <div className="grid max-w-4xl gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">当前：{documents[index].id}</span>
        <Button type="button" variant="outline" size="sm" onClick={switchDocument}>
          切换外部文档
        </Button>
      </div>
      <MarkdownEditor
        documentId={documents[index].id}
        value={value}
        height={320}
        onChange={setValue}
      />
    </div>
  );
}

function MarkdownEditorShowcase() {
  return (
    <StoryShowcase
      title="Markdown Editor"
      description="在一个页面内验收编辑、尺寸、只读、Wiki Link、上传、受控更新和复杂内容边界。"
    >
      <StoryCase title="基础编辑" description="使用完整 Markdown 文档验收工具栏、输入和块级结构。">
        <CompleteEditorDemo />
      </StoryCase>

      <StoryCase title="空白与尺寸" description="固定高度与自动增长使用相同的空白初始状态。">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">固定高度 260px</span>
            <ControlledEditor
              documentId="editor-fixed-height"
              initialValue=""
              height={260}
              placeholder="记录一个值得长期保留的想法…"
            />
          </div>
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">自动增长，最大 420px</span>
            <ControlledEditor
              documentId="editor-auto-height"
              initialValue=""
              height="auto"
              maxHeight={420}
              placeholder="从空白开始输入…"
            />
          </div>
        </div>
      </StoryCase>

      <StoryCase title="只读模式" description="同一份正文不可编辑，也不显示编辑控件。">
        <MarkdownEditor
          documentId="editor-readonly"
          value={fullMarkdownStoryDocument}
          readOnly
          height={420}
        />
      </StoryCase>

      <StoryCase
        title="Wiki Link 与媒体上传"
        description="联想覆盖 loading、ready、empty、error；支持粘贴或拖入图片和视频。"
      >
        <SuggestionAndUploadDemo />
      </StoryCase>

      <StoryCase title="受控更新" description="外部切换 documentId 与 value 后，编辑器同步新文档。">
        <ExternalUpdateDemo />
      </StoryCase>

      <StoryCase
        title="复杂内容与窄容器"
        description="长代码、宽表格、深层内容和连续字符串不能造成页面级横向溢出。"
      >
        <div className="w-[360px] max-w-full">
          <ControlledEditor
            documentId="editor-boundaries"
            initialValue={markdownBoundaryDocument}
            height={640}
          />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Capture/基本组件",
  component: MarkdownEditor,
  parameters: {
    layout: "padded",
  },
  args: {
    value: fullMarkdownStoryDocument,
    height: 620,
  },
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MarkdownEditorStory: Story = {
  name: "Markdown Editor",
  render: () => <MarkdownEditorShowcase />,
};
