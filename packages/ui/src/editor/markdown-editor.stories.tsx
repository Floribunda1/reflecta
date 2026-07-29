import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "#components/button";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import {
  MarkdownEditor,
  MarkdownPreview,
  SimpleMarkdownPreview,
  type MarkdownEditorProps,
  type MarkdownEditorSuggestionSource,
} from ".";

const completeDocument = `# Storybook 组件验收

这份文档集中覆盖编辑器最常见和最危险的 Markdown 结构，包括 **粗体**、_斜体_、~~删除线~~、[链接](https://example.com) 与 \`inline code\`。

## 列表与引用

- 普通列表
  - 嵌套列表
  - [x] 已完成任务
  - [ ] 待处理任务

1. 确认组件边界
2. 补齐交互状态

> Storybook 验收组件本身。
>
> > E2E 验收真实产品流程。

---

### 表格

| Module | 验收重点 | 状态 |
| --- | --- | --- |
| Capture | 编辑、预览、Wiki Link | 进行中 |
| Agent | Streaming、Tool、Proposal | 待验收 |

#### 代码

\`\`\`ts
type StoryState = "默认" | "交互" | "边界";
const packageName = "@reflecta/ui";
\`\`\`

##### 媒体与引用

![Reflecta 示例图](data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='720' height='180'%3E%3Crect width='100%25' height='100%25' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23334155' font-size='28'%3EReflecta Markdown%3C/text%3E%3C/svg%3E)

关联内容：[[组件边界#understanding-boundary]]、[[Storybook 验收#context-storybook]]。

###### 最末级标题

中英混排与超长链接也应保持正常换行：https://example.com/a/very/long/path/that/should/not-break/the/editor/layout?from=storybook
`;

const longDocument = `${completeDocument}

## 长内容压力

\`\`\`text
${"pnpm --filter @reflecta/ui build-storybook --reporter=verbose ".repeat(8)}
\`\`\`

| 很长的列标题 | 第二列 | 第三列 | 第四列 |
| --- | --- | --- | --- |
| ${"不会主动截断但必须留在容器内 ".repeat(8)} | A | B | C |
`;

const suggestions = [
  {
    id: "understanding-boundary",
    label: "组件边界",
    preview: "展示语义属于 UI package，查询和 IPC 留在 Adapter。",
    markdown: "[[组件边界#understanding-boundary]]",
  },
  {
    id: "context-storybook",
    label: "Storybook 验收",
    preview: "集中观察组件状态、交互与危险边界。",
    markdown: "[[Storybook 验收#context-storybook]]",
  },
  {
    id: "domain-ui",
    label: "UI 架构",
    preview: "Capture 与 Agent 的组件归属。",
    markdown: "[[UI 架构#domain-ui]]",
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

function ExternalUpdateDemo() {
  const documents = [
    { id: "capture-a", value: "# 第一份文档\n\n可以在这里继续编辑。" },
    { id: "capture-b", value: "# 第二份文档\n\n切换后编辑器需要同步外部内容。" },
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
        height={420}
        getSuggestions={getSuggestions}
        uploadAsset={async (file) => {
          if (file.name.includes("失败")) throw new Error("模拟上传失败");
          return { url: URL.createObjectURL(file), alt: file.name };
        }}
        onChange={setValue}
      />
    </div>
  );
}

function CompleteEditorDemo() {
  const [openedLink, setOpenedLink] = useState("尚未打开 Wiki Link");
  return (
    <div className="grid gap-3">
      <ControlledEditor
        documentId="showcase-complete"
        initialValue={completeDocument}
        height={560}
        getSuggestions={getSuggestions}
        uploadAsset={async (file) => ({ url: URL.createObjectURL(file), alt: file.name })}
        onWikiLinkOpen={setOpenedLink}
      />
      <div className="text-xs text-muted-foreground">{openedLink}</div>
    </div>
  );
}

function PreviewLevelsDemo() {
  const [openedLink, setOpenedLink] = useState("尚未打开 Wiki Link");
  return (
    <div className="grid gap-8">
      <MarkdownPreview value={completeDocument} zoomImages={false} onWikiLinkOpen={setOpenedLink} />
      <div className="text-xs text-muted-foreground">{openedLink}</div>
      <div className="grid gap-3 rounded-lg border p-4">
        <span className="text-xs font-medium text-muted-foreground">Understanding Row 摘要</span>
        <SimpleMarkdownPreview value={completeDocument} lineClamp={3} />
      </div>
    </div>
  );
}

function MarkdownEditorShowcase() {
  return (
    <StoryShowcase
      title="Markdown Editor"
      description="集中验收完整编辑、空白自动高度、只读、联想与上传、外部文档切换、危险边界和两级预览。"
    >
      <StoryCase
        title="完整文档"
        description="覆盖主要 Markdown 结构、Wiki Link、联想和图片上传。"
        className="xl:col-span-2"
      >
        <CompleteEditorDemo />
      </StoryCase>
      <StoryCase title="空白与自动高度" description="输入区域从占位文案开始，最高增长到 420px。">
        <ControlledEditor
          documentId="showcase-empty"
          initialValue=""
          height="auto"
          maxHeight={420}
          placeholder="记录一个值得长期保留的想法…"
          getSuggestions={getSuggestions}
        />
      </StoryCase>
      <StoryCase title="只读" description="复用编辑器排版，但不允许修改内容。">
        <MarkdownEditor
          documentId="showcase-readonly"
          value={completeDocument}
          readOnly
          height={420}
        />
      </StoryCase>
      <StoryCase
        title="联想、上传与外部更新"
        description="切换文档后同步外部 value；输入 Wiki Link 或拖入文件可继续验收。"
        className="xl:col-span-2"
      >
        <ExternalUpdateDemo />
      </StoryCase>
      <StoryCase
        title="长代码、宽表格与窄容器"
        description="360px 容器内保持内部滚动，不产生页面级横向溢出。"
      >
        <div className="w-[360px] max-w-full">
          <ControlledEditor
            documentId="showcase-boundaries"
            initialValue={longDocument}
            height={640}
          />
        </div>
      </StoryCase>
      <StoryCase title="完整预览与列表摘要" description="对比完整正文和三行摘要的排版层级。">
        <PreviewLevelsDemo />
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
    value: completeDocument,
    height: 620,
  },
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MarkdownEditorStory: Story = {
  name: "Markdown Editor",
  render: () => <MarkdownEditorShowcase />,
};
