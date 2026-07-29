import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import { useAutoFrame } from "../../../.storybook/use-auto-frame";
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

const userTextRow: ChatMessageRowView = {
  message: {
    kind: "user",
    id: "user-text",
    text: "请复核低温窗口中的阀门启动顺序。",
  },
  timestampLabel: "7月28日 12:58:00",
  enabledActions: ["copy", "edit"],
};

const userEmptyRow: ChatMessageRowView = {
  message: {
    kind: "user",
    id: "user-empty",
  },
  timestampLabel: "7月28日 12:59:00",
  enabledActions: ["copy"],
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

function StreamingTextSequence() {
  const frames = ["正在", "正在生成", "正在生成 **流式内容**。"];
  const frame = useAutoFrame(frames.length);
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
  return <ChatMessageRow row={row} />;
}

const pendingRow: ChatMessageRowView = {
  message: { kind: "assistant", id: "assistant-pending", status: "streaming", blocks: [] },
};

const stoppedRow: ChatMessageRowView = {
  ...assistantRow,
  message: {
    kind: "assistant",
    id: assistantRow.message.id,
    status: "stopped",
    blocks: assistantRow.message.kind === "assistant" ? assistantRow.message.blocks : [],
  },
};

const failedRow: ChatMessageRowView = {
  message: {
    kind: "assistant",
    id: "assistant-failed",
    status: "failed",
    blocks: [],
    error: "模型连接中断。",
  },
};

const compactionRow: ChatMessageRowView = {
  message: {
    kind: "assistant",
    id: "assistant-compaction",
    status: "done",
    blocks: [
      {
        kind: "context-compaction",
        compaction: {
          id: "compaction-1",
          summary:
            "保留了用户目标、Storybook 高 ROI 准入门槛、组件迁移边界、Streaming identity 约束，以及尚未完成的测试工作。\n\n删除了已经完成的中间排查细节。",
          tokensBefore: 128_400,
          estimatedTokensAfter: 29_200,
        },
      },
    ],
  },
};

const longRow: ChatMessageRowView = {
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
};

function MessageShowcase() {
  return (
    <StoryShowcase
      title="Message"
      description="集中验收用户与 Assistant 消息、搜索高亮、流式 identity、等待、停止、失败、上下文压缩和窄容器边界。"
    >
      <StoryCase
        title="用户消息"
        description="纯文本、Entity + 混合附件和空内容 fallback 连续比较。"
      >
        <div className="grid gap-6">
          <ChatMessageRow row={userTextRow} />
          <ChatMessageRow row={userRow} />
          <ChatMessageRow row={userEmptyRow} />
        </div>
      </StoryCase>
      <StoryCase title="Assistant 完成态" description="思考、Tool 与最终文本组合。">
        <ChatMessageRow row={assistantRow} />
      </StoryCase>
      <StoryCase
        title="搜索高亮与操作"
        description="Hover 或聚焦消息检查操作栏，并比较当前命中与文字命中。"
      >
        <ChatMessageRow row={{ ...assistantRow, highlighted: true }} search={{ query: "流式" }} />
      </StoryCase>
      <StoryCase
        title="流式更新与稳定 Identity"
        description="文本自动逐帧更新，消息和 block id 保持不变。"
      >
        <StreamingTextSequence />
      </StoryCase>
      <StoryCase title="生命周期" description="等待、停止和失败在同一页面位置连续比较。">
        <div className="grid gap-6">
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">等待回复</span>
            <ChatMessageRow row={pendingRow} />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">已停止</span>
            <ChatMessageRow row={stoppedRow} />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">回复失败</span>
            <ChatMessageRow row={failedRow} />
          </div>
        </div>
      </StoryCase>
      <StoryCase title="上下文压缩" description="可展开查看压缩摘要与 Token 变化。">
        <ChatMessageRow row={compactionRow} />
      </StoryCase>
      <StoryCase title="长内容与窄容器" description="长中文、超长命令和操作栏不能撑破消息宽度。">
        <div className="w-[360px] max-w-full">
          <ChatMessageRow row={longRow} />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/基本组件",
  component: ChatMessageRow,
  args: {
    row: assistantRow,
  },
} satisfies Meta<typeof ChatMessageRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MessageStory: Story = {
  name: "Message",
  render: () => <MessageShowcase />,
};
