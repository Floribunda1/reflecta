import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../../components/button";
import { AgentExecutionBlock } from "./agent-execution-block";
import type { AgentExecutionStatus, AgentToolActivityView, AgentToolDetailsView } from "./types";

function activity(
  id: string,
  summary: string,
  details?: AgentToolDetailsView,
  status: AgentExecutionStatus = "done",
): AgentToolActivityView {
  return {
    id,
    status,
    summary,
    items: [{ id: `${id}:item:0`, label: summary, details }],
  };
}

const toolFixtures = {
  Read: {
    summary: "读取了「packages/ui/src/chat/message/chat-message-row.tsx」",
    details: {
      meta: [{ label: "路径", value: "packages/ui/src/chat/message/chat-message-row.tsx" }],
      rows: [
        {
          id: "read-content",
          label: "文件",
          title: "chat-message-row.tsx",
          content: {
            format: "pre",
            preview: "export function ChatMessageRow() { … }",
          },
        },
      ],
    },
  },
  Edit: {
    summary: "编辑了「chat-message-row.stories.tsx」",
    details: {
      rows: [
        {
          id: "edit-diff",
          label: "Diff",
          title: "补充中文 Story 名称",
          content: {
            format: "pre",
            preview: '- title: "Chat/Message Row"\n+ title: "Agent/基本组件/Message"',
          },
        },
      ],
    },
  },
  Write: {
    summary: "写入了「agent-compositions.stories.tsx」",
    details: {
      meta: [
        {
          label: "路径",
          value: "packages/ui/src/chat/compositions/agent-compositions.stories.tsx",
        },
        { label: "大小", value: "8.4 KB" },
      ],
    },
  },
  SafeBash: {
    summary: "执行了 Bash · bun run build-storybook",
    details: {
      meta: [
        { label: "cwd", value: "/workspace/reflecta/packages/ui" },
        { label: "退出码", value: "0" },
      ],
      rows: [
        {
          id: "bash-output",
          label: "输出",
          title: "Storybook build",
          content: {
            format: "pre",
            preview: "storybook build\n✓ built in 2.38s",
          },
        },
      ],
    },
  },
  DomainList: {
    summary: "列出 4 个 Domain",
    details: {
      rows: ["产品", "技术", "UI 架构", "测试"].map((title, index) => ({
        id: `domain-${index}`,
        label: "Domain",
        title,
      })),
    },
  },
  DomainInspect: {
    summary: "查看了「技术 / UI 架构」",
    details: {
      meta: [
        { label: "路径", value: "技术 / UI 架构" },
        { label: "Understanding", value: "12" },
      ],
    },
  },
  UnderstandingList: {
    summary: "列出 8 条 Understanding",
    details: {
      rows: ["组件边界", "Storybook 验收", "Streaming identity"].map((title, index) => ({
        id: `understanding-${index}`,
        label: "Understanding",
        title,
        meta: [`更新于 ${index + 1} 小时前`],
      })),
    },
  },
  UnderstandingGet: {
    summary: "读取了「组件边界」",
    details: {
      rows: [
        {
          id: "understanding-content",
          label: "Understanding",
          title: "组件边界",
          content: {
            format: "markdown",
            preview: "把 **展示语义** 放在 `packages/ui`，把 query 和 IPC 留在 Adapter。",
          },
        },
      ],
    },
  },
  ContextList: {
    summary: "列出 5 条 Context",
    details: {
      rows: ["Storybook 验收", "组件迁移记录", "Agent 失败复盘"].map((title, index) => ({
        id: `context-${index}`,
        label: "Context",
        title,
      })),
    },
  },
  ContextGet: {
    summary: "读取了「Storybook 验收」",
    details: {
      rows: [
        {
          id: "context-content",
          label: "Context",
          title: "Storybook 验收",
          content: {
            format: "markdown",
            preview: "重点观察 streaming、确认、拒绝、失败和长内容。",
          },
        },
      ],
    },
  },
  AttachmentRead: {
    summary: "读取了「design-notes.pdf」",
    details: {
      meta: [
        { label: "类型", value: "application/pdf" },
        { label: "页数", value: "18" },
      ],
      rows: [
        {
          id: "attachment-extract",
          label: "摘录",
          title: "Storybook 设计结论",
          content: { format: "text", value: "只验收高价值组件及其组合效果。" },
        },
      ],
    },
  },
  RetrieveKnowledge: {
    summary: "检索到 3 条 Understanding",
    details: {
      meta: [{ label: "查询", value: "Storybook 组件验收" }],
      rows: ["组件边界", "视觉回归", "交互状态"].map((title, index) => ({
        id: `retrieval-${index}`,
        label: `${96 - index * 7}%`,
        title,
        content: {
          format: "markdown",
          preview: `与 **${title}** 相关的知识摘要。`,
        },
      })),
    },
  },
  Graph: {
    summary: "查看了 6 条 Understanding 的关联图",
    details: {
      meta: [
        { label: "节点", value: "6" },
        { label: "关系", value: "8" },
      ],
      rows: [{ id: "graph-focus", label: "中心节点", title: "Storybook 验收" }],
    },
  },
  WebSearch: {
    summary: "搜索了网页「Storybook interaction testing」",
    details: {
      rows: [
        {
          id: "search-source-1",
          label: "来源",
          title: "Storybook Docs",
          meta: ["https://storybook.js.org/docs/writing-tests/interaction-testing"],
        },
        {
          id: "search-source-2",
          label: "来源",
          title: "Component Story Format",
          meta: ["https://storybook.js.org/docs/api/csf"],
        },
      ],
    },
  },
  FetchContent: {
    summary: "读取了 Storybook 官方文档",
    details: {
      rows: [
        {
          id: "fetched-content",
          label: "网页",
          title: "Interaction tests",
          content: {
            format: "markdown",
            preview: "Story 的交互可以通过 play function 或本地状态稳定重放。",
          },
        },
      ],
    },
  },
  GetSearchContent: {
    summary: "读取了搜索结果正文",
    details: {
      rows: [
        {
          id: "search-content",
          label: "正文",
          title: "Storybook 组件验收策略",
          content: {
            format: "markdown",
            preview: "优先覆盖 **独特交互** 与 **丰富状态**。",
          },
        },
      ],
    },
  },
  LegacySearch: {
    summary: "搜索到 2 条 Understanding",
    details: {
      rows: ["旧版 Storybook 结构", "组件迁移记录"].map((title, index) => ({
        id: `legacy-${index}`,
        label: "历史结果",
        title,
      })),
    },
  },
  Unknown: {
    summary: "完成了未来版本 Tool",
    details: {
      meta: [{ label: "Tool", value: "FutureTool" }],
      rows: [
        {
          id: "unknown-safe-field",
          label: "内容",
          title: "安全回退",
          content: { format: "text", value: "未知字段不会直接暴露原始 payload。" },
        },
      ],
    },
  },
} satisfies Record<string, { summary: string; details: AgentToolDetailsView }>;

const meta = {
  title: "Agent/基本组件/Execution",
  component: AgentExecutionBlock,
  args: {
    defaultExpanded: true,
    block: {
      kind: "tool-activity",
      activity: activity("Read", toolFixtures.Read.summary, toolFixtures.Read.details),
    },
  },
} satisfies Meta<typeof AgentExecutionBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

function toolStory(key: keyof typeof toolFixtures): Story {
  const fixture = toolFixtures[key];
  return {
    args: {
      block: {
        kind: "tool-activity",
        activity: activity(key, fixture.summary, fixture.details),
      },
    },
  };
}

export const ReadTool = { ...toolStory("Read"), name: "Tool · Read" } satisfies Story;
export const EditTool = { ...toolStory("Edit"), name: "Tool · Edit" } satisfies Story;
export const WriteTool = { ...toolStory("Write"), name: "Tool · Write" } satisfies Story;
export const SafeBashTool = {
  ...toolStory("SafeBash"),
  name: "Tool · Safe Bash",
} satisfies Story;
export const DomainListTool = {
  ...toolStory("DomainList"),
  name: "Tool · Domain List",
} satisfies Story;
export const DomainInspectTool = {
  ...toolStory("DomainInspect"),
  name: "Tool · Domain Inspect",
} satisfies Story;
export const UnderstandingListTool = {
  ...toolStory("UnderstandingList"),
  name: "Tool · Understanding List",
} satisfies Story;
export const UnderstandingGetTool = {
  ...toolStory("UnderstandingGet"),
  name: "Tool · Understanding Get",
} satisfies Story;
export const ContextListTool = {
  ...toolStory("ContextList"),
  name: "Tool · Context List",
} satisfies Story;
export const ContextGetTool = {
  ...toolStory("ContextGet"),
  name: "Tool · Context Get",
} satisfies Story;
export const AttachmentReadTool = {
  ...toolStory("AttachmentRead"),
  name: "Tool · Attachment Read",
} satisfies Story;
export const RetrieveKnowledgeTool = {
  ...toolStory("RetrieveKnowledge"),
  name: "Tool · Retrieve Knowledge",
} satisfies Story;
export const GraphTool = { ...toolStory("Graph"), name: "Tool · Graph" } satisfies Story;
export const WebSearchTool = {
  ...toolStory("WebSearch"),
  name: "Tool · Web Search",
} satisfies Story;
export const FetchContentTool = {
  ...toolStory("FetchContent"),
  name: "Tool · Fetch Content",
} satisfies Story;
export const GetSearchContentTool = {
  ...toolStory("GetSearchContent"),
  name: "Tool · Get Search Content",
} satisfies Story;
export const LegacySearchTool = {
  ...toolStory("LegacySearch"),
  name: "Tool · Legacy Search",
} satisfies Story;
export const UnknownTool = {
  ...toolStory("Unknown"),
  name: "Tool · Unknown 回退",
} satisfies Story;

function ReasoningLifecycleDemo() {
  const frames = [
    "",
    "正在比较 **UI ownership**",
    "正在比较 **UI ownership** 与 Renderer Adapter，并确认 streaming identity。",
  ];
  const [frame, setFrame] = useState(0);
  const completed = frame === frames.length - 1;

  return (
    <div className="grid max-w-3xl gap-3">
      <AgentExecutionBlock
        block={{
          kind: "reasoning",
          reasoning: {
            id: "reasoning-stable",
            status: completed ? "done" : "streaming",
            markdown: frames[frame],
          },
        }}
      />
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

export const ReasoningLifecycle: Story = {
  name: "Reasoning · 流式生命周期",
  render: () => <ReasoningLifecycleDemo />,
};

export const Pending: Story = {
  name: "Pending · 等待状态",
  args: {
    block: {
      kind: "pending",
      pending: { id: "pending-1", label: "正在规划下一步操作" },
    },
  },
};

export const ContextCompaction: Story = {
  name: "Context Compaction · 长摘要",
  args: {
    block: {
      kind: "context-compaction",
      compaction: {
        id: "compaction-1",
        summary:
          "保留了用户目标、Storybook 高 ROI 准入门槛、组件迁移边界、Streaming identity 约束，以及尚未完成的全量测试工作。\n\n删除了已经完成的中间排查细节。",
        tokensBefore: 128_400,
        estimatedTokensAfter: 29_200,
      },
    },
  },
};

function ToolLifecycleDemo() {
  const [status, setStatus] = useState<AgentExecutionStatus>("running");
  const fixture = toolFixtures.SafeBash;
  const view = activity("safe-bash-stable", fixture.summary, fixture.details, status);
  if (status === "failed") {
    view.items = [
      {
        ...view.items[0],
        error: "命令执行超时，请检查进程输出后重试。",
      },
    ];
  }

  return (
    <div className="grid max-w-3xl gap-3">
      <AgentExecutionBlock block={{ kind: "tool-activity", activity: view }} defaultExpanded />
      <div className="flex flex-wrap gap-2">
        {(["running", "done", "failed"] as const).map((next) => (
          <Button
            key={next}
            type="button"
            size="sm"
            variant={status === next ? "default" : "outline"}
            onClick={() => setStatus(next)}
          >
            {next === "running" ? "运行中" : next === "done" ? "完成" : "失败"}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const ToolLifecycle: Story = {
  name: "Tool · 运行、完成与失败",
  render: () => <ToolLifecycleDemo />,
};

export const LongCommand: Story = {
  name: "Tool 边界 · 超长命令与输出",
  args: {
    block: {
      kind: "tool-activity",
      activity: activity(
        "safe-bash-long",
        `执行了 Bash · ${"bun run --cwd packages/ui build-storybook ".repeat(5)}`,
        {
          meta: [
            {
              label: "cwd",
              value:
                "/Users/example/a-very-long-workspace-name/reflecta/packages/ui/storybook/acceptance",
            },
          ],
          rows: [
            {
              id: "long-command-output",
              label: "输出",
              title: "完整构建日志",
              content: {
                format: "pre",
                preview: "transforming... 3356 modules\nrendering chunks...",
                full: Array.from(
                  { length: 40 },
                  (_, index) => `[${index + 1}/40] 构建 Storybook 资源与组件预览`,
                ).join("\n"),
              },
            },
          ],
        },
      ),
    },
  },
};

export const ManyResults: Story = {
  name: "Tool 边界 · 大量结果",
  args: {
    block: {
      kind: "tool-activity",
      activity: activity("knowledge-many", "检索到 36 条 Understanding", {
        rows: Array.from({ length: 36 }, (_, index) => ({
          id: `many-result-${index}`,
          label: `${Math.max(42, 98 - index)}%`,
          title: `第 ${index + 1} 条 Understanding · ${"较长标题 ".repeat((index % 3) + 1)}`,
          meta: [`Domain：技术 / UI 架构 / Storybook`, `更新于 ${index + 1} 小时前`],
        })),
      }),
    },
  },
};

export const LongContent: Story = {
  name: "Tool 边界 · 长正文与截断",
  args: {
    block: {
      kind: "tool-activity",
      activity: activity("content-long", "读取了长篇 Context", {
        rows: [
          {
            id: "long-context",
            label: "Context",
            title: "Storybook 组件验收完整讨论",
            content: {
              format: "markdown",
              preview: "## 摘要\n\n" + "只展示前几段内容。".repeat(12),
              full:
                completeLongContent("## 完整内容\n\n", 48) +
                "\n\n[[组件边界#understanding-boundary]]",
            },
          },
        ],
      }),
    },
  },
};

function completeLongContent(prefix: string, paragraphs: number) {
  return (
    prefix +
    Array.from(
      { length: paragraphs },
      (_, index) => `${index + 1}. Storybook 只验收高价值组件的状态、交互与边界。`,
    ).join("\n\n")
  );
}
