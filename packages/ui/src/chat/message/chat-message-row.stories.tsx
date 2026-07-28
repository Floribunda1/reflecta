import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
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
        name: "layout.png",
        mediaType: "image/png",
        previewUrl: "https://placehold.co/480x240/png",
      },
      { id: "attachment-2", name: "notes.pdf", mediaType: "application/pdf" },
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
  title: "Chat/Message Row",
  component: ChatMessageRow,
  args: {
    row: assistantRow,
  },
} satisfies Meta<typeof ChatMessageRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const User: Story = { args: { row: userRow } };
export const Assistant: Story = {};
export const SearchHighlight: Story = {
  args: { row: { ...assistantRow, highlighted: true }, search: { query: "流式" } },
};
export const Pending: Story = {
  args: {
    row: {
      message: { kind: "assistant", id: "assistant-pending", status: "streaming", blocks: [] },
    },
  },
};
export const Stopped: Story = {
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
      <button
        type="button"
        className="w-fit rounded-md border px-3 py-1.5 text-sm"
        onClick={() => setFrame((current) => (current + 1) % frames.length)}
      >
        下一帧
      </button>
    </div>
  );
}

export const StreamingIdentity: Story = { render: () => <StreamingTextSequence /> };
