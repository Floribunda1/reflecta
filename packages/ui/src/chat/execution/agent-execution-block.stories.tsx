import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentExecutionBlock } from "./agent-execution-block";
import type { AgentToolActivityView } from "./types";

const details = {
  meta: [
    { label: "查询", value: "UI component boundaries" },
    { label: "范围", value: "knowledge base" },
  ],
  rows: [
    {
      id: "result-1",
      label: "Understanding",
      title: "组件边界",
      content: {
        format: "markdown" as const,
        preview: "将 **展示语义** 放在 UI package，将查询和 IPC 留在 Adapter。",
      },
      meta: ["Domain：UI 架构"],
    },
  ],
};

function activity(summary: string, id = "tool-1"): AgentToolActivityView {
  return {
    id,
    status: "done",
    summary,
    items: [{ id, label: summary, details }],
  };
}

const meta = {
  title: "Chat/Agent Execution",
  component: AgentExecutionBlock,
  args: {
    defaultExpanded: true,
    block: { kind: "tool-activity", activity: activity("读取了相关内容") },
  },
} satisfies Meta<typeof AgentExecutionBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReasoningStreaming: Story = {
  args: {
    block: {
      kind: "reasoning",
      reasoning: {
        id: "reasoning-1",
        status: "streaming",
        markdown: "正在比较 **UI ownership** 与 App workflow…",
      },
    },
  },
};

export const ContextCompaction: Story = {
  args: {
    block: {
      kind: "context-compaction",
      compaction: {
        id: "compaction-1",
        summary: "保留了目标、架构决策与尚未完成的迁移工作。",
        tokensBefore: 28400,
        estimatedTokensAfter: 9200,
      },
    },
  },
};

export const Pending: Story = {
  args: { block: { kind: "pending", pending: { id: "pending-1" } } },
};

export const Running: Story = {
  args: {
    block: {
      kind: "tool-activity",
      activity: {
        ...activity("正在读取本地文件"),
        status: "running",
        items: [{ id: "read-1", label: "正在读取本地文件" }],
      },
    },
  },
};

export const Failed: Story = {
  args: {
    block: {
      kind: "tool-activity",
      activity: {
        ...activity("读取本地文件失败"),
        status: "failed",
        items: [
          {
            id: "read-1",
            label: "读取本地文件失败",
            details,
            error: "文件不存在。",
          },
        ],
      },
    },
  },
};

const toolStories = [
  ["Read", "读取了「agent-turn-view.ts」"],
  ["Edit", "编辑了「message-list.tsx」"],
  ["Write", "写入了「chat-message.tsx」"],
  ["SafeBash", "执行了 Bash · bun test"],
  ["DomainList", "列出 4 个 Domain"],
  ["DomainInspect", "查看了「UI 架构」下的内容"],
  ["UnderstandingList", "列出 8 条 Understanding"],
  ["UnderstandingGet", "读取了「组件边界」"],
  ["ContextList", "列出 5 条 Context"],
  ["ContextGet", "读取了「Storybook 验收」"],
  ["AttachmentRead", "读取了「design-notes.pdf」"],
  ["RetrieveKnowledge", "检索到 3 条 Understanding"],
  ["Graph", "查看了 6 条 Understanding 的关联图"],
  ["WebSearch", "已搜索网页「Streamdown」"],
  ["FetchContent", "已读取来源"],
  ["GetSearchContent", "已读取搜索内容"],
  ["LegacySearch", "搜索到 2 条 Understanding"],
] as const;

function toolStory(name: string, summary: string): Story {
  return {
    args: {
      block: { kind: "tool-activity", activity: activity(summary, name) },
    },
  };
}

export const ReadTool = toolStory("Read", "读取了「agent-turn-view.ts」");
export const EditTool = toolStory("Edit", "编辑了「message-list.tsx」");
export const WriteTool = toolStory("Write", "写入了「chat-message.tsx」");
export const SafeBashTool = toolStory("SafeBash", "执行了 Bash · bun test");
export const DomainListTool = toolStory("DomainList", "列出 4 个 Domain");
export const DomainInspectTool = toolStory("DomainInspect", "查看了「UI 架构」下的内容");
export const UnderstandingListTool = toolStory("UnderstandingList", "列出 8 条 Understanding");
export const UnderstandingGetTool = toolStory("UnderstandingGet", "读取了「组件边界」");
export const ContextListTool = toolStory("ContextList", "列出 5 条 Context");
export const ContextGetTool = toolStory("ContextGet", "读取了「Storybook 验收」");
export const AttachmentReadTool = toolStory("AttachmentRead", "读取了「design-notes.pdf」");
export const RetrieveKnowledgeTool = toolStory("RetrieveKnowledge", "检索到 3 条 Understanding");
export const GraphTool = toolStory("Graph", "查看了 6 条 Understanding 的关联图");
export const WebSearchTool = toolStory("WebSearch", "已搜索网页「Streamdown」");
export const FetchContentTool = toolStory("FetchContent", "已读取来源");
export const GetSearchContentTool = toolStory("GetSearchContent", "已读取搜索内容");
export const LegacySearchTool = toolStory("LegacySearch", "搜索到 2 条 Understanding");

export const ActiveTools = {
  render: () => (
    <div className="grid max-w-3xl gap-3">
      {toolStories.map(([name, summary]) => (
        <AgentExecutionBlock
          key={name}
          block={{ kind: "tool-activity", activity: activity(summary, name) }}
        />
      ))}
    </div>
  ),
} satisfies Story;

function ToolStreamingSequence() {
  const [done, setDone] = useState(false);
  const view = activity(done ? "读取了「stream.ts」" : "正在读取「stream.ts」", "read-stream");
  view.status = done ? "done" : "running";
  view.items = done
    ? [{ id: "read-stream", label: view.summary, details }]
    : [{ id: "read-stream", label: view.summary }];
  return (
    <div className="grid max-w-3xl gap-3">
      <AgentExecutionBlock block={{ kind: "tool-activity", activity: view }} />
      <button
        type="button"
        className="w-fit rounded-md border px-3 py-1.5 text-sm"
        onClick={() => setDone((current) => !current)}
      >
        {done ? "回到 running" : "切换到 completed"}
      </button>
    </div>
  );
}

export const StreamingLifecycle: Story = {
  render: () => <ToolStreamingSequence />,
};
