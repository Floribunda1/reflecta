import type { Meta, StoryObj } from "@storybook/react-vite";
import { useAutoFrame } from "../../../.storybook/use-auto-frame";
import type { ChatEntityReference } from "../entity";
import { entityKey } from "../entity-visual";
import { ChatMarkdown } from "./chat-markdown";

const presentations = new Map([
  ["understanding:u_1", { state: "ready" as const, label: "组件边界", canOpen: true }],
  ["context:c_1", { state: "loading" as const, label: "Context 加载中" }],
  ["domain:d_1", { state: "ready" as const, label: "UI 架构", canOpen: false }],
  ["context:missing", { state: "unavailable" as const, label: "引用不可用" }],
  ["understanding:error", { state: "error" as const, label: "引用加载失败" }],
]);

const entityBindings = {
  resolveEntity: (reference: ChatEntityReference) => presentations.get(entityKey(reference)),
  onEntityOpen: () => undefined,
};

const completeMarkdown = `# Agent Markdown 完整语法

正文支持 **粗体**、_斜体_、~~删除线~~、[外部链接](https://example.com) 与 \`inline code\`。

## 列表

- 普通列表
  - 嵌套列表
  - [x] 已完成任务
  - [ ] 待确认任务

1. 分析组件边界
2. 执行 Tool
3. 汇总结果

> Agent 的回答可以包含引用。
>
> > 嵌套引用仍需保持清晰层级。

---

### 表格

| Module | 状态 | 负责人 |
| --- | --- | --- |
| Markdown | streaming | UI |
| Tool | completed | Agent |

#### 代码

\`\`\`ts
type AgentStatus = "streaming" | "done" | "failed";
const stableBlockId = "assistant-1:text:0";
\`\`\`

##### 数学公式与 Mermaid

行内公式：$E = mc^2$

$$
\\text{ROI} = \\frac{\\text{发现的回归}}{\\text{维护成本}}
$$

\`\`\`mermaid
flowchart LR
  User["用户消息"] --> Tool["Tool 执行"]
  Tool --> Answer["最终回复"]
\`\`\`

###### Entity reference

- 可打开：[[u:u_1]]
- 加载中：[[c:c_1]]
- 不可打开 Domain：[[d:d_1]]
- 不可用：[[c:missing]]
- 错误：[[u:error]]
- 无 resolver 结果：[[u:unknown]]

![示例图片](data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23dbeafe'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%231e3a8a' font-size='26'%3EAgent Markdown%3C/text%3E%3C/svg%3E)

最后是一段中英混排：Storybook 用于验证 component streaming behavior，而 E2E 负责真实 workflow。
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
      "[Storybook](https://example.com)\n\n[[u:u_1]]",
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
    <div className="grid max-w-3xl gap-4">
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        当前语法：{current.label} · 第 {current.frame}/{current.frameCount} 帧 · 自动播放
      </div>
      <div className="min-h-40 rounded-lg border p-4">
        <ChatMarkdown value={current.value} {...entityBindings} />
      </div>
    </div>
  );
}

const longCode = "const payload = " + JSON.stringify({ content: "非常长的连续内容".repeat(80) });
const boundaryMarkdown = `# 边界内容

超长 URL：https://example.com/${"storybook/agent/markdown/".repeat(12)}

\`\`\`ts
${longCode}
\`\`\`

| ${"很宽的表头 ".repeat(10)} | 第二列 | 第三列 | 第四列 |
| --- | --- | --- | --- |
| ${"很长的表格内容 ".repeat(16)} | A | B | C |

超长 Entity：[[u:u_1]]
`;

const meta = {
  title: "Agent/基本组件/Markdown",
  component: ChatMarkdown,
  args: {
    value: completeMarkdown,
    ...entityBindings,
  },
} satisfies Meta<typeof ChatMarkdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompleteSyntax: Story = {
  name: "完整语法",
};

export const StreamingIncompleteSyntax: Story = {
  name: "流式不完整语法",
  render: () => <StreamingSyntaxDemo />,
};

export const DangerousBoundaries: Story = {
  name: "长代码、宽表格与窄容器",
  render: () => (
    <div className="w-[360px] max-w-full rounded-lg border p-4">
      <ChatMarkdown value={boundaryMarkdown} tone="muted" {...entityBindings} />
    </div>
  ),
};
