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

const conversationMarkdownCases = [
  {
    label: "长篇分析",
    value: `结论先说：这版并不是颜色选错了，而是**每一层都在争夺注意力**。正文、标题、粗体和行内代码同时变亮，读者就很难判断应该先看哪里。

## 1. 真正的问题是强调没有主次

页面同时使用了大标题、粗体段落、亮色链接和带描边的 \`inline code\`。这些手段单独看都成立，但连续出现在一个长回复里，就会形成大片高对比区域。**当重点超过正文的少数部分时，重点本身也会失效。**

再看段落节奏：长句已经需要持续阅读，如果段前、段后和标题间距都接近，内容会变成一整面墙。更稳妥的处理是让正文保持稳定，只让标题领先半级，并把链接与代码交给不同的视觉语义。

## 2. 调整顺序应该先减法，再换颜色

先降低标题和粗体的重量，再统一代码样式，最后才判断背景是否真的有问题。这样每一步都能回答一个清楚的问题，也不会用新的颜色掩盖旧的层级问题。`,
  },
  {
    label: "实施总结",
    value: `排版调整已完成，核心变化集中在共享的 Markdown 主题：

- \`strong\` 只承担语义强调，不再把整段文字推到最高亮度。
- \`code\` 使用中性底色与等宽字体；蓝色只保留给可点击链接。
- 标题、段落和列表使用同一套垂直节奏。
  - 长回复保持连续阅读。
  - 短回复不会产生多余留白。
- 默认宽度沿用生产会话的 \`max-w-4xl\`，不增加新的布局配置。

## 验证结果

样式在[暗色主题](https://example.com/themes/dark)与浅色主题下均保持可读；代码、列表和长中文段落没有溢出。相关组件位于 [chat-markdown.tsx](https://example.com/source/chat-markdown.tsx)。`,
  },
  {
    label: "简短决策",
    value: `建议先不增加“紧凑 / 舒适”模式，当前只有一种明确的会话阅读场景。

> 先把默认值做好，再用真实反馈决定是否需要配置。

1. 收敛正文、标题和粗体的层级。
2. 用 Storybook 固定长篇分析与实施总结。
3. 只有用户明确需要更高密度时，再增加显示选项。

**何时重新评估：** 同一种排版无法同时满足长文阅读和高频日志扫描时。`,
  },
] as const;

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
      <StoryCase
        title="典型对话中的阅读层级"
        description="连续比较长篇分析、实施总结和简短决策，观察真实内容密度下的标题、强调、代码、链接与段落节奏。"
      >
        <div className="grid max-w-4xl divide-y">
          {conversationMarkdownCases.map((sample) => (
            <div key={sample.label} className="grid gap-3 py-8 first:pt-0 last:pb-0">
              <span className="text-xs font-medium text-muted-foreground">{sample.label}</span>
              <ChatMarkdown value={sample.value} />
            </div>
          ))}
        </div>
      </StoryCase>

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
