import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import { useAutoFrame } from "../../../.storybook/use-auto-frame";
import { Button } from "../../components/button";
import { ChatComposer } from "../composer/chat-composer";
import { ChatMessageRow } from "../message/chat-message-row";
import type { AgentMessageBlockView, ChatMessageRowView } from "../message/types";
import type { AgentProposalLifecycle, AgentProposalView } from "../proposal/types";

const modelOptions = [
  {
    id: "openai:gpt-5",
    label: "GPT-5.2",
    providerLabel: "OpenAI",
    reasoningOptions: [
      { id: "off", label: "关闭推理" },
      { id: "medium", label: "中推理" },
      { id: "high", label: "高推理" },
    ],
  },
] as const;

const searchEntities = async () => [];

const userRow: ChatMessageRowView = {
  message: {
    kind: "user",
    id: "composition-user",
    text: "请检查 Storybook 的组件边界，并补齐 Agent streaming 验收。",
    entities: [{ id: "storybook-context", type: "context", label: "Storybook 验收" }],
  },
  timestampLabel: "18:20",
  enabledActions: ["copy", "edit"],
};

function Composer({ running = false }: { running?: boolean }) {
  return (
    <ChatComposer
      draftId="composition-draft"
      status={running ? "running" : "idle"}
      canStop
      modelOptions={modelOptions}
      selectedModelId="openai:gpt-5"
      selectedReasoningId="medium"
      contextUsage={{
        percent: running ? 61 : 58,
        label: running ? "61%" : "58%",
        description: running ? "当前上下文：78.1K / 128K" : "当前上下文：74.2K / 128K",
      }}
      searchEntities={searchEntities}
      onSubmit={async () => undefined}
      onStop={() => undefined}
    />
  );
}

function StorySurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[720px] w-full max-w-4xl grid-rows-[1fr_auto] overflow-hidden rounded-xl border bg-background shadow-sm">
      {children}
    </div>
  );
}

function TypicalTaskDemo() {
  const frame = useAutoFrame(3, 1_800);
  const blocks: AgentMessageBlockView[] =
    frame === 0
      ? []
      : [
          {
            kind: "reasoning",
            reasoning: {
              id: "typical-reasoning",
              status: frame === 1 ? "streaming" : "done",
              markdown:
                frame === 1
                  ? "先检查现有 Story 的"
                  : "先检查现有 Story 的覆盖范围，再按 visual family 收敛状态。",
            },
          },
          {
            kind: "tool-activity",
            activity: {
              id: "typical-read",
              status: "done",
              summary: "读取了 Storybook 设计计划",
              items: [
                {
                  id: "typical-read:item",
                  label: "Storybook 设计计划",
                  details: {
                    meta: [{ label: "范围", value: "Capture / Agent / Knowledge Wander" }],
                  },
                },
              ],
            },
          },
          {
            kind: "tool-activity",
            activity: {
              id: "typical-build",
              status: frame === 1 ? "running" : "done",
              summary: frame === 1 ? "正在构建 Storybook" : "Storybook 构建完成 · 3356 modules",
              items: [
                {
                  id: "typical-build:item",
                  label: "build-storybook",
                  details:
                    frame === 2
                      ? {
                          meta: [
                            { label: "耗时", value: "2.4s" },
                            { label: "结果", value: "成功" },
                          ],
                        }
                      : undefined,
                },
              ],
            },
          },
          ...(frame === 2
            ? ([
                {
                  kind: "text",
                  id: "typical-answer",
                  status: "done",
                  markdown:
                    "已完成 Storybook 结构收敛：\n\n- 导航与 fixture 已中文化；\n- Tool streaming 使用稳定 ID；\n- 组合 Story 只保留能观察密度和层级的场景。",
                },
              ] satisfies AgentMessageBlockView[])
            : []),
        ];
  const assistantRow: ChatMessageRowView = {
    message: {
      kind: "assistant",
      id: "typical-assistant",
      status: frame === 2 ? "done" : "streaming",
      blocks,
    },
    timestampLabel: frame === 2 ? "18:21" : undefined,
    enabledActions: frame === 2 ? ["copy", "fork", "regenerate"] : [],
  };

  return (
    <StorySurface>
      <div className="grid content-start gap-7 overflow-auto p-6">
        <ChatMessageRow row={userRow} />
        <ChatMessageRow row={assistantRow} />
      </div>
      <div className="border-t bg-background p-4">
        <Composer running={frame !== 2} />
      </div>
    </StorySurface>
  );
}

function ApprovalTaskDemo() {
  const [lifecycle, setLifecycle] = useState<AgentProposalLifecycle>("pending");

  useEffect(() => {
    if (lifecycle !== "running") return;
    const timer = window.setTimeout(() => setLifecycle("completed"), 1_200);
    return () => window.clearTimeout(timer);
  }, [lifecycle]);

  const proposal: AgentProposalView = {
    id: "approval-composition",
    kind: "bash",
    title: "执行 Storybook 构建",
    lifecycle,
    decisionEnabled: lifecycle === "pending",
    content: {
      command: "bun run --cwd packages/ui build-storybook",
      cwd: "/workspace/reflecta",
      timeoutMs: 120_000,
    },
    note: lifecycle === "completed" ? "Storybook 构建完成" : undefined,
    error: lifecycle === "failed" ? "构建失败：发现 TypeScript 错误" : undefined,
  };
  const blocks: AgentMessageBlockView[] = [
    {
      kind: "reasoning",
      reasoning: {
        id: "approval-reasoning",
        status: "done",
        markdown: "构建会执行本地命令，需要用户确认。",
      },
    },
    { kind: "proposal", proposal },
    ...(lifecycle === "completed" || lifecycle === "rejected" || lifecycle === "failed"
      ? ([
          {
            kind: "text",
            id: "approval-answer",
            status: "done",
            markdown:
              lifecycle === "completed"
                ? "构建已经完成，可以开始视觉验收。"
                : lifecycle === "rejected"
                  ? "已拒绝执行，本地文件没有变化。"
                  : "构建没有通过，需要修复错误后重试。",
          },
        ] satisfies AgentMessageBlockView[])
      : []),
  ];
  const assistantRow: ChatMessageRowView = {
    message: {
      kind: "assistant",
      id: "approval-assistant",
      status: lifecycle === "pending" || lifecycle === "running" ? "streaming" : "done",
      blocks,
    },
  };

  return (
    <StorySurface>
      <div className="grid content-start gap-7 overflow-auto p-6">
        <ChatMessageRow
          row={userRow}
          onProposalDecision={({ decision }) =>
            setLifecycle(decision === "approve" ? "running" : "rejected")
          }
        />
        <ChatMessageRow
          row={assistantRow}
          onProposalDecision={({ decision }) =>
            setLifecycle(decision === "approve" ? "running" : "rejected")
          }
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setLifecycle("pending")}>
            重置确认
          </Button>
        </div>
      </div>
      <div className="border-t bg-background p-4">
        <Composer running={lifecycle === "running"} />
      </div>
    </StorySurface>
  );
}

const denseAssistantRow: ChatMessageRowView = {
  message: {
    kind: "assistant",
    id: "dense-assistant",
    status: "stopped",
    blocks: [
      {
        kind: "reasoning",
        reasoning: {
          id: "dense-reasoning",
          status: "done",
          markdown: "已检查 17 种 Tool，下面保留关键结果与异常。",
        },
      },
      ...Array.from({ length: 7 }, (_, index) => ({
        kind: "tool-activity" as const,
        activity: {
          id: `dense-tool-${index}`,
          status: index === 4 ? ("failed" as const) : ("done" as const),
          summary:
            index === 4
              ? "执行超长命令失败"
              : `完成第 ${index + 1} 个 Tool · ${"较长摘要 ".repeat((index % 3) + 1)}`,
          items: [
            {
              id: `dense-tool-${index}:item`,
              label: `Tool ${index + 1}`,
              details:
                index === 2
                  ? {
                      rows: Array.from({ length: 18 }, (_, rowIndex) => ({
                        id: `dense-result-${rowIndex}`,
                        label: "结果",
                        title: `第 ${rowIndex + 1} 条 Understanding`,
                      })),
                    }
                  : index === 4
                    ? {
                        rows: [
                          {
                            id: "dense-command",
                            label: "命令",
                            title: "build-storybook",
                            content: {
                              format: "pre" as const,
                              preview: "bun run --cwd packages/ui build-storybook ".repeat(8),
                            },
                          },
                        ],
                      }
                    : undefined,
              error: index === 4 ? "命令超时，进程已停止。" : undefined,
            },
          ],
        },
      })),
      {
        kind: "text",
        id: "dense-partial-answer",
        status: "streaming",
        markdown: "已经完成大部分检查，但任务在汇总前被停止。当前可见内容仍然需要保留。",
      },
    ],
  },
  enabledActions: ["copy", "regenerate"],
};

function DenseFailureDemo() {
  return (
    <StorySurface>
      <div className="grid content-start gap-7 overflow-auto p-6">
        <ChatMessageRow row={userRow} />
        <ChatMessageRow row={denseAssistantRow} />
      </div>
      <div className="border-t bg-background p-4">
        <Composer />
      </div>
    </StorySurface>
  );
}

function AgentCompositionShowcase() {
  return (
    <StoryShowcase
      title="Agent 组合场景"
      description="把核心组件放回完整对话密度中，同页观察典型任务、用户确认以及高密度异常任务。"
    >
      <StoryCase
        title="典型任务"
        description="自动经历等待、思考、Tool 执行和最终回答。"
        className="xl:col-span-2"
        contentClassName="p-0"
      >
        <TypicalTaskDemo />
      </StoryCase>
      <StoryCase
        title="确认任务"
        description="确认或拒绝后，任务状态自动推进并保留完整对话上下文。"
        className="xl:col-span-2"
        contentClassName="p-0"
      >
        <ApprovalTaskDemo />
      </StoryCase>
      <StoryCase
        title="高密度与异常"
        description="多个 Tool、长结果、失败和停止状态叠加后的整体信息层级。"
        className="xl:col-span-2"
        contentClassName="p-0"
      >
        <DenseFailureDemo />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/组合场景样式",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompositionStory: Story = {
  name: "全部场景",
  render: () => <AgentCompositionShowcase />,
};
