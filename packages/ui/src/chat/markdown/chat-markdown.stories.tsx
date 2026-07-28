import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatMarkdown } from "./chat-markdown";
import type { ChatEntityReference } from "../entity";
import { entityKey } from "../entity-visual";

const presentations = new Map([
  ["understanding:u_1", { state: "ready" as const, label: "组件边界", canOpen: true }],
  ["context:c_1", { state: "loading" as const, label: "Context" }],
  ["domain:d_1", { state: "ready" as const, label: "UI 架构", canOpen: false }],
  ["context:missing", { state: "unavailable" as const, label: "引用不可用" }],
  ["understanding:error", { state: "error" as const, label: "引用加载失败" }],
]);

const content = `# Agent Markdown

正文支持 **强调**、列表、表格、代码与实体引用。

- 可打开：[[u:u_1]]
- 加载中：[[c:c_1]]
- 不可打开 Domain：[[d:d_1]]
- 不可用：[[c:missing]]
- 错误：[[u:error]]
- 无 resolver：[[u:unknown]]

| Module | 状态 |
| --- | --- |
| Markdown | ready |

\`\`\`ts
const reference = "[[u:not-rendered-in-code]]";
\`\`\`
`;

const meta = {
  title: "Chat/Markdown",
  component: ChatMarkdown,
  args: {
    value: content,
    resolveEntity: (reference: ChatEntityReference) => presentations.get(entityKey(reference)),
    onEntityOpen: (reference: ChatEntityReference) => {
      window.alert(`Open ${entityKey(reference)}`);
    },
  },
} satisfies Meta<typeof ChatMarkdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EntityStates: Story = {};

export const Muted: Story = {
  args: {
    tone: "muted",
  },
};

export const Streaming: Story = {
  args: {
    value: "正在生成 **未完成的强调，以及一个未完成引用 [[u:",
  },
};
