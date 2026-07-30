import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import { useAutoFrame } from "../../../.storybook/use-auto-frame";
import {
  markdownBoundaryDocument,
  markdownStorySections,
} from "../../editor/markdown-story-fixtures";
import type { ChatEntityReference } from "../entity";
import { entityKey } from "../entity-visual";
import { ChatMarkdown } from "./chat-markdown";

const presentations = new Map([
  ["understanding:u_irrigation", { state: "ready" as const, label: "分区灌溉策略", canOpen: true }],
  ["context:c_night_shift", { state: "loading" as const, label: "夜班联调记录加载中" }],
  ["domain:d_facility", { state: "ready" as const, label: "设施工程", canOpen: false }],
  ["context:missing", { state: "unavailable" as const, label: "引用不可用" }],
  ["understanding:error", { state: "error" as const, label: "引用加载失败" }],
]);

const resolveEntity = (reference: ChatEntityReference) => presentations.get(entityKey(reference));

const diagramsAndMath = markdownStorySections.mathAndNested;

const entityMarkdown = `## Reflecta Entity

- 可打开：[[u:u_irrigation]]
- 加载中：[[c:c_night_shift]]
- 不可打开 Domain：[[d:d_facility]]
- 不可用：[[c:missing]]
- 错误：[[u:error]]
- 无 resolver 结果：[[u:unknown]]
`;

const streamingCases = [
  {
    label: "未闭合强调",
    frames: ["正在生成 **重要", "正在生成 **重要结论", "正在生成 **重要结论**。"],
  },
  {
    label: "未闭合代码块",
    frames: [
      "```ts",
      "```ts\nconst status =",
      '```ts\nconst status = "streaming";',
      '```ts\nconst status = "streaming";\n```',
    ],
  },
  {
    label: "未完成表格",
    frames: [
      "| Module |",
      "| Module | 状态 |\n| ---",
      "| Module | 状态 |\n| --- | --- |\n| Tool",
      "| Module | 状态 |\n| --- | --- |\n| Tool | running |",
    ],
  },
  {
    label: "未完成链接与 Entity",
    frames: [
      "[Storybook",
      "[Storybook](https://",
      "[Storybook](https://example.com)\n\n[[u:",
      "[Storybook](https://example.com)\n\n[[u:u_irrigation]]",
    ],
  },
  {
    label: "未完成 Mermaid 与公式",
    frames: [
      "```mermaid\nflowchart LR",
      '```mermaid\nflowchart LR\n  A["输入"] -->',
      '```mermaid\nflowchart LR\n  A["输入"] --> B["输出"]\n```',
      '```mermaid\nflowchart LR\n  A["输入"] --> B["输出"]\n```\n\n$E = mc^2$',
    ],
  },
] as const;

const streamingFrames = streamingCases.flatMap((entry) =>
  entry.frames.map((value, index) => ({
    label: entry.label,
    value,
    frame: index + 1,
    frameCount: entry.frames.length,
  })),
);

function StreamingSyntaxDemo() {
  const current = streamingFrames[useAutoFrame(streamingFrames.length)];

  return (
    <div className="grid max-w-4xl gap-3">
      <p className="text-sm text-muted-foreground">
        当前语法：{current.label} · 第 {current.frame}/{current.frameCount} 帧 · 自动播放
      </p>
      <div className="min-h-40">
        <ChatMarkdown value={current.value} streaming resolveEntity={resolveEntity} />
      </div>
    </div>
  );
}

function EntityDemo() {
  const [opened, setOpened] = useState("尚未打开 Entity");
  return (
    <div className="grid gap-3">
      <ChatMarkdown
        value={entityMarkdown}
        resolveEntity={resolveEntity}
        onEntityOpen={(reference) => setOpened(`已打开：${reference.type}:${reference.id}`)}
      />
      <p className="text-xs text-muted-foreground">{opened}</p>
    </div>
  );
}

function MarkdownShowcase() {
  return (
    <StoryShowcase
      title="Markdown"
      description="按语法族集中验收 Agent Markdown 的完整内容、Reflecta 扩展、自动 Streaming 和几何边界。"
    >
      <StoryCase title="标题与行内样式">
        <ChatMarkdown value={markdownStorySections.headingsAndInline} />
      </StoryCase>

      <StoryCase title="列表与引用">
        <ChatMarkdown value={markdownStorySections.listsAndQuotes} />
      </StoryCase>

      <StoryCase
        title="代码与表格"
        description="覆盖 JavaScript、Python、CSS、JSON、Bash 和多种表格对齐。"
      >
        <ChatMarkdown value={markdownStorySections.codeAndTables} />
      </StoryCase>

      <StoryCase
        title="媒体与扩展语法"
        description="图片、HTML、details、kbd、脚注和定义列表按 renderer 支持能力展示或安全降级。"
      >
        <ChatMarkdown value={markdownStorySections.mediaAndExtensions} />
      </StoryCase>

      <StoryCase title="数学公式与 Mermaid">
        <ChatMarkdown value={diagramsAndMath} />
      </StoryCase>

      <StoryCase
        title="Reflecta Entity"
        description="并排包含 ready、loading、不可打开、unavailable、error 和 fallback。"
      >
        <EntityDemo />
      </StoryCase>

      <StoryCase
        title="自动 Streaming"
        description="同一个组件实例自动循环未闭合强调、代码块、表格、链接、Entity、Mermaid 和公式。"
      >
        <StreamingSyntaxDemo />
      </StoryCase>

      <StoryCase
        title="空内容与几何边界"
        description="空白内容、长 URL、长代码、宽表格和连续字符串不能撑破窄容器。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-[240px_360px]">
          <div className="min-h-24">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">空字符串</span>
            <ChatMarkdown value="" />
          </div>
          <div className="w-[360px] max-w-full">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">窄容器</span>
            <ChatMarkdown
              value={markdownBoundaryDocument}
              tone="muted"
              resolveEntity={resolveEntity}
            />
          </div>
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/基本组件",
  component: ChatMarkdown,
  args: {
    value: markdownStorySections.headingsAndInline,
    resolveEntity,
  },
} satisfies Meta<typeof ChatMarkdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MarkdownStory: Story = {
  name: "Markdown",
  render: () => <MarkdownShowcase />,
};
