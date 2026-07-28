import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../components/button";
import { ChatMessageRow } from "./chat-message-row";
import type { ChatMessageRowView } from "./types";

const userRow: ChatMessageRowView = {
  message: {
    kind: "user",
    id: "user-1",
    text: "请结合这些上下文检查 UI 迁移。",
    entities: [
      { id: "entity-1", type: "understanding", label: "组件边界" },
      { id: "entity-2", type: "domain", label: "UI 架构" },
    ],
    attachments: [
      {
        id: "attachment-1",
        name: "agent-layout.png",
        mediaType: "image/png",
        previewUrl:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='240'%3E%3Crect width='100%25' height='100%25' fill='%23dbeafe'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%231e3a8a' font-size='24'%3EAgent Layout%3C/text%3E%3C/svg%3E",
      },
      {
        id: "attachment-2",
        name: "Storybook-组件验收说明-长文件名.pdf",
        mediaType: "application/pdf",
      },
    ],
  },
  timestampLabel: "7月28日 13:00:00",
  enabledActions: ["copy", "edit"],
};

const assistantRow: ChatMessageRowView = {
  message: {
    kind: "assistant",
    id: "assistant-1",
    status: "done",
    blocks: [
      {
        kind: "reasoning",
        reasoning: {
          id: "reasoning-1",
          status: "done",
          markdown: "先确认 ownership，再验证 stream identity。",
        },
      },
      {
        kind: "tool-activity",
        activity: {
          id: "tool-1",
          status: "done",
          summary: "读取了组件实现",
          items: [{ id: "tool-1", label: "读取了组件实现" }],
        },
      },
      {
        kind: "text",
        id: "text-1",
        status: "done",
        markdown: "迁移边界已经确认，**流式 block 的 id 保持稳定**。",
      },
    ],
  },
  timestampLabel: "7月28日 13:00:04",
  enabledActions: ["copy", "fork", "regenerate"],
};

const meta = {
  title: "Agent/基本组件/Message",
  component: ChatMessageRow,
  args: {
    row: assistantRow,
  },
} satisfies Meta<typeof ChatMessageRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const User: Story = {
  name: "用户消息",
  args: { row: userRow },
};
export const Assistant: Story = {
  name: "Assistant 完成态",
};
export const SearchHighlight: Story = {
  name: "搜索高亮与操作",
  args: { row: { ...assistantRow, highlighted: true }, search: { query: "流式" } },
};
export const Pending: Story = {
  name: "等待回复",
  args: {
    row: {
      message: { kind: "assistant", id: "assistant-pending", status: "streaming", blocks: [] },
    },
  },
};
export const Stopped: Story = {
  name: "已停止",
  args: {
    row: {
      ...assistantRow,
      message: {
        kind: "assistant",
        id: assistantRow.message.id,
        status: "stopped",
        blocks: assistantRow.message.kind === "assistant" ? assistantRow.message.blocks : [],
      },
    },
  },
};
export const Failed: Story = {
  name: "回复失败",
  args: {
    row: {
      message: {
        kind: "assistant",
        id: "assistant-failed",
        status: "failed",
        blocks: [],
        error: "模型连接中断。",
      },
    },
  },
};

function StreamingTextSequence() {
  const frames = ["正在", "正在生成", "正在生成 **流式内容**。"];
  const [frame, setFrame] = useState(0);
  const row: ChatMessageRowView = {
    message: {
      kind: "assistant",
      id: "assistant-stream",
      status: frame === frames.length - 1 ? "done" : "streaming",
      blocks: [
        {
          kind: "text",
          id: "assistant-stream:text:0",
          status: frame === frames.length - 1 ? "done" : "streaming",
          markdown: frames[frame],
        },
      ],
    },
  };
  return (
    <div className="grid max-w-2xl gap-3">
      <ChatMessageRow row={row} />
      <Button
        type="button"
        className="w-fit"
        size="sm"
        onClick={() => setFrame((current) => (current + 1) % frames.length)}
      >
        下一帧
      </Button>
    </div>
  );
}

export const StreamingIdentity: Story = {
  name: "流式更新与稳定 Identity",
  render: () => <StreamingTextSequence />,
};

export const DangerousBoundaries: Story = {
  name: "长内容与窄容器",
  args: {
    row: {
      message: {
        kind: "assistant",
        id: "assistant-long",
        status: "done",
        blocks: [
          {
            kind: "text",
            id: "assistant-long:text:0",
            status: "done",
            markdown: `## 长回复

${"这是一段用于观察中文长内容换行、段落间距和消息宽度的回答。".repeat(16)}

\`\`\`bash
${"bun run --cwd packages/ui build-storybook --verbose ".repeat(8)}
\`\`\``,
          },
        ],
      },
      enabledActions: ["copy", "fork", "regenerate"],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[360px] max-w-full">
        <Story />
      </div>
    ),
  ],
};
