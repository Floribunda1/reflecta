import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AgentReducedAssistantBlock } from "../../../../apps/electron/src/preload/typings/agent";
import {
  buildAgentTurnView,
  toAgentProposalView,
  toAgentToolActivityView,
  type AgentViewPresentation,
} from "../../../../apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { useAutoFrame } from "../../.storybook/use-auto-frame";
import { Button } from "../components/button";
import { AgentExecutionBlock } from "./execution/agent-execution-block";
import { AgentProposalCard } from "./proposal/agent-proposal-card";

type ToolBlock = Extract<AgentReducedAssistantBlock, { kind: "tool" }>;
type ApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;

const createdAt = "2026-07-29T00:00:00.000Z";
const presentation: AgentViewPresentation = {
  entityLabels: new Map([
    ["understanding:u-components", "组件边界"],
    ["context:c-storybook", "Storybook 验收"],
  ]),
  domainPath: (id) =>
    (
      ({
        "d-technology": "技术",
        "d-ui": "技术 / UI 架构",
      }) as Record<string, string>
    )[id] ?? id,
};

function tool(
  toolName: string,
  input: unknown,
  output: unknown,
  overrides: Partial<ToolBlock> = {},
): ToolBlock {
  return {
    kind: "tool",
    toolCallId: `tool-${toolName}`,
    toolName,
    input,
    output,
    state: "completed",
    createdAt,
    ...overrides,
  };
}

function approval(
  toolName: string,
  title: string,
  payload: unknown,
  overrides: Partial<ApprovalBlock> = {},
): ApprovalBlock {
  return {
    kind: "approval",
    approvalId: `approval-${toolName}`,
    toolCallId: `approval-tool-${toolName}`,
    toolName,
    title,
    payload,
    state: "pending",
    approvalState: "pending",
    executionState: "not_started",
    displayState: "pending_approval",
    createdAt,
    ...overrides,
  };
}

function toolActivity(block: ToolBlock) {
  const view = buildAgentTurnView([block]).blocks[0];
  if (view?.kind !== "tool-activity") throw new Error(`无法展示 Tool：${block.toolName}`);
  return toAgentToolActivityView(view.activity, block.toolCallId);
}

function proposalView(block: ApprovalBlock) {
  const view = buildAgentTurnView([block]).blocks[0];
  if (view?.kind !== "proposal") throw new Error(`无法展示确认 Tool：${block.toolName}`);
  return toAgentProposalView(view.proposal, block, presentation);
}

const completedTools: readonly ToolBlock[] = [
  tool(
    "read",
    { path: "packages/ui/src/chat/message/chat-message-row.tsx", offset: 1, limit: 120 },
    {
      content: "export function ChatMessageRow() {\n  return <article />;\n}",
      truncated: false,
    },
  ),
  tool(
    "edit",
    { path: "packages/ui/src/chat/message/chat-message-row.tsx" },
    {
      patch:
        "--- a/chat-message-row.tsx\n+++ b/chat-message-row.tsx\n@@\n-  return null;\n+  return <article />;",
    },
  ),
  tool("write", { path: "packages/ui/src/chat/tool.stories.tsx" }, { bytesWritten: 8_420 }),
  tool(
    "bash",
    { command: "bun run storybook:build", cwd: "/workspace/reflecta" },
    { exitCode: 0, stdout: "storybook build\n✓ built in 3.25s", stderr: "" },
  ),
  tool("domain_list", {}, [
    { id: "d-technology", name: "技术" },
    { id: "d-ui", name: "UI 架构" },
  ]),
  tool(
    "domain_inspect",
    { domainId: "d-ui" },
    {
      domain: { id: "d-ui", name: "UI 架构" },
      domains: [],
      understandings: [
        {
          id: "u-components",
          title: "组件边界",
          body: "展示语义属于 UI，runtime 只提供事实。",
        },
      ],
      contexts: [
        {
          id: "c-storybook",
          title: "Storybook 验收",
          content: "验收真实的 production presentation。",
          medium: "experience",
        },
      ],
    },
  ),
  tool(
    "understanding_list",
    { domainIds: ["d-ui"] },
    {
      understandings: [
        {
          id: "u-components",
          title: "组件边界",
          body: "展示语义属于 UI，runtime 只提供事实。",
          domains: [{ id: "d-ui", name: "UI 架构" }],
        },
        {
          id: "u-streaming",
          title: "Streaming identity",
          body: "流式更新期间保持稳定 ID。",
          domains: [{ id: "d-ui", name: "UI 架构" }],
        },
      ],
    },
  ),
  tool(
    "understanding_get",
    { understandingId: "u-components" },
    {
      understanding: {
        id: "u-components",
        title: "组件边界",
        body: "把 **展示语义** 放在 UI 层，把 runtime 事实留给 Adapter。",
        contextCount: 3,
        connectionCount: 4,
        domains: [{ id: "d-ui", name: "UI 架构" }],
      },
    },
  ),
  tool(
    "context_list",
    { understandingId: "u-components" },
    {
      contexts: [
        {
          id: "c-storybook",
          title: "Storybook 验收",
          content: "重点观察 streaming、确认、拒绝与失败。",
          medium: "experience",
        },
      ],
    },
  ),
  tool(
    "context_get",
    { contextId: "c-storybook" },
    {
      context: {
        id: "c-storybook",
        title: "Storybook 验收",
        content: "Story 必须消费和 production 相同的 presentation seam。",
        medium: "experience",
      },
    },
  ),
  tool(
    "attachment_read",
    { attachmentId: "attachment-design" },
    {
      filename: "design-notes.pdf",
      kind: "pdf",
      totalPages: 18,
      content: "只验收有定制样式、独特交互或丰富状态的组件。",
    },
  ),
  tool(
    "retrieve_knowledge",
    { query: "Storybook 组件验收" },
    {
      candidates: [
        {
          id: "u-components",
          title: "组件边界",
          snippet: "Storybook 与 production 共用展示转换。",
          matchedContexts: [
            {
              id: "c-storybook",
              title: "Storybook 验收",
              snippet: "不要在 Story 里重写 Tool 展示语义。",
              medium: "experience",
            },
          ],
        },
      ],
    },
  ),
  tool(
    "graph",
    { understandingId: "u-components", depth: 2 },
    {
      nodes: [
        { id: "u-components", title: "组件边界" },
        { id: "u-streaming", title: "Streaming identity" },
      ],
      edges: [{ source: "u-components", target: "u-streaming" }],
    },
  ),
  tool("web_search", { query: "Storybook interaction testing" }, { results: [] }),
  tool(
    "fetch_content",
    { urls: ["https://storybook.js.org/docs/writing-tests/interaction-testing"] },
    { pages: [] },
  ),
  tool(
    "get_search_content",
    { url: "https://storybook.js.org/docs/writing-tests/interaction-testing" },
    { content: "Interaction tests render the story and play interactions." },
  ),
];

type ApprovalFixture = {
  block: ApprovalBlock;
  output: unknown;
};

const approvalTools: readonly ApprovalFixture[] = [
  {
    block: approval(
      "understanding_create",
      "候选 Understanding",
      {
        title: "组件边界",
        body: "把 **展示语义** 放在 UI 层。",
        domainIds: ["d-ui"],
      },
      { preview: true },
    ),
    output: { resultRefType: "understanding", resultRefId: "u-new" },
  },
  {
    block: approval("understanding_update", "候选修改 Understanding", {
      understandingId: "u-components",
      before: { title: "组件边界", body: "Renderer 持有 UI。" },
      after: { title: "组件边界", body: "UI 持有展示，Renderer 只做 Adapter。" },
      domainIds: ["d-ui"],
      reason: "让 Storybook 与 production 共用展示入口。",
    }),
    output: { resultRefType: "understanding", resultRefId: "u-components" },
  },
  {
    block: approval("understanding_delete", "候选删除 Understanding", {
      understandingId: "u-components",
      reason: "内容已经合并。",
    }),
    output: { resultRefType: "understanding", resultRefId: "u-components" },
  },
  {
    block: approval("domain_create", "候选 Domain", {
      name: "组件验收",
      parentId: "d-technology",
      reason: "集中 UI 验收相关理解。",
    }),
    output: { resultRefType: "domain", resultRefId: "d-new" },
  },
  {
    block: approval("domain_update", "候选修改 Domain", {
      domainId: "d-ui",
      name: "UI 与交互",
      parentId: null,
    }),
    output: { resultRefType: "domain", resultRefId: "d-ui" },
  },
  {
    block: approval("domain_delete", "候选删除 Domain", {
      domainId: "d-ui",
      deleteUnderstandings: true,
      reason: "这个 Domain 已经不再使用。",
    }),
    output: { resultRefType: "domain", resultRefId: "d-ui" },
  },
  {
    block: approval("context_create", "候选 Context", {
      understandingId: "u-components",
      medium: "experience",
      title: "Storybook 验收",
      content: "用真实 production adapter 构造所有 Tool 卡片。",
    }),
    output: { resultRefType: "context", resultRefId: "c-new" },
  },
  {
    block: approval("context_update", "候选修改 Context", {
      contextId: "c-storybook",
      understandingId: "u-components",
      medium: "ai",
      title: "Storybook Tool 验收",
      content: "覆盖 streaming、确认、拒绝、完成和失败。",
    }),
    output: { resultRefType: "context", resultRefId: "c-storybook" },
  },
  {
    block: approval("context_delete", "候选删除 Context", {
      contextId: "c-storybook",
      reason: "内容重复。",
    }),
    output: { resultRefType: "context", resultRefId: "c-storybook" },
  },
  {
    block: approval("bash", "确认危险 Bash", {
      command: "bun run --cwd packages/ui build-storybook",
      cwd: "/workspace/reflecta",
      timeoutMs: 120_000,
    }),
    output: { exitCode: 0, stdout: "Storybook build completed", stderr: "" },
  },
];

function ToolCard({
  block,
  defaultExpanded = false,
}: {
  block: ToolBlock;
  defaultExpanded?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <code className="px-3 text-xs text-muted-foreground">{block.toolName}</code>
      <AgentExecutionBlock
        block={{ kind: "tool-activity", activity: toolActivity(block) }}
        defaultExpanded={defaultExpanded}
      />
    </div>
  );
}

function AutoStreamingTool() {
  const frame = useAutoFrame(4);
  const completed = frame === 3;
  const block = tool(
    "bash",
    { command: "bun run storybook:build", cwd: "/workspace/reflecta" },
    completed ? { exitCode: 0, stdout: "✓ Storybook build completed", stderr: "" } : undefined,
    {
      toolCallId: "tool-auto-streaming",
      state: completed ? "completed" : "running",
    },
  );

  return <ToolCard block={block} defaultExpanded />;
}

function InteractiveProposalCard({ fixture }: { fixture: ApprovalFixture }) {
  const [block, setBlock] = useState(fixture.block);

  useEffect(() => {
    if (!block.preview && block.displayState !== "running") return;
    const timer = window.setTimeout(
      () =>
        setBlock((current) =>
          current.preview
            ? { ...current, preview: false }
            : {
                ...current,
                output: fixture.output,
                state: "completed",
                approvalState: "approved",
                executionState: "completed",
                displayState: "completed",
              },
        ),
      1_200,
    );
    return () => window.clearTimeout(timer);
  }, [block.displayState, block.preview, fixture.output]);

  return (
    <div className="grid min-w-0 gap-1">
      <code className="px-3 text-xs text-muted-foreground">{block.toolName}</code>
      <AgentProposalCard
        proposal={proposalView(block)}
        onDecision={({ decision }) =>
          setBlock((current) =>
            decision === "approve"
              ? {
                  ...current,
                  state: "approved",
                  approvalState: "approved",
                  executionState: "running",
                  displayState: "running",
                }
              : {
                  ...current,
                  state: "rejected",
                  approvalState: "rejected",
                  executionState: "not_started",
                  displayState: "rejected",
                },
          )
        }
      />
    </div>
  );
}

function ToolGallery() {
  const [proposalGeneration, setProposalGeneration] = useState(0);
  const failed = tool(
    "bash",
    { command: "bun run storybook:build", cwd: "/workspace/reflecta" },
    undefined,
    {
      toolCallId: "tool-bash-failed",
      state: "failed",
      error: "命令执行超时，请检查进程输出后重试。",
    },
  );
  const manyResults = tool(
    "understanding_list",
    { domainIds: ["d-ui"], limit: 36 },
    {
      understandings: Array.from({ length: 36 }, (_, index) => ({
        id: `u-${index + 1}`,
        title: `第 ${index + 1} 条 Understanding · ${"较长标题 ".repeat((index % 3) + 1)}`,
        body: "用于观察大量结果时的折叠策略。",
        domains: [{ id: "d-ui", name: "UI 架构" }],
      })),
    },
  );
  const longCommand = tool(
    "bash",
    {
      command:
        "bun run --cwd packages/ui build-storybook --debug --profile --output-dir ./artifacts/storybook-static ".repeat(
          5,
        ),
      cwd: "/Users/example/projects/reflecta/packages/ui/a/very/deep/storybook/acceptance/path",
    },
    {
      exitCode: 0,
      stdout: Array.from(
        { length: 40 },
        (_, index) => `[${index + 1}/40] 构建 Storybook 资源与组件预览`,
      ).join("\n"),
      stderr: "",
      truncated: true,
    },
  );

  return (
    <StoryShowcase
      title="Tool"
      description="集中验收所有 production Tool 的完成、确认、拒绝、自动流式、失败和极端内容状态。"
    >
      <StoryCase
        title="自动流式展示"
        description="使用稳定的 toolCallId 自动从运行中推进到完成，然后重新开始。"
        className="xl:col-span-2"
      >
        <AutoStreamingTool />
      </StoryCase>
      <StoryCase
        title="生产环境 Tool"
        description="以下卡片由 production 的 runtime block 转换函数生成，可点击展开或折叠详情。"
        className="xl:col-span-2"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {completedTools.map((block) => (
            <ToolCard key={block.toolCallId} block={block} />
          ))}
        </div>
      </StoryCase>
      <StoryCase
        title="需要确认的 Tool"
        description="确认后自动进入执行中并完成；拒绝后直接显示 production 拒绝态。"
        className="xl:col-span-2"
        contentClassName="grid gap-4"
      >
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setProposalGeneration((current) => current + 1)}
          >
            重置全部
          </Button>
        </div>
        <div key={proposalGeneration} className="grid items-start gap-4 xl:grid-cols-2">
          {approvalTools.map((fixture) => (
            <InteractiveProposalCard key={fixture.block.approvalId} fixture={fixture} />
          ))}
        </div>
      </StoryCase>
      <StoryCase
        title="异常与边界"
        description="仍然使用实际 bash 与 understanding_list Tool，只改变输入、输出和执行状态。"
        className="xl:col-span-2"
        contentClassName="grid gap-4"
      >
        <div className="grid gap-4">
          <ToolCard block={failed} defaultExpanded />
          <ToolCard block={longCommand} />
          <ToolCard block={manyResults} />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/基本组件",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToolStory: Story = {
  name: "Tool",
  render: () => <ToolGallery />,
};
