import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentProposalCard } from "./agent-proposal-card";
import type { AgentProposalView } from "./types";

const base = {
  id: "approval-1",
  title: "候选操作",
  lifecycle: "pending" as const,
  decisionEnabled: true,
};

const proposals = {
  understandingCreate: {
    ...base,
    kind: "understanding-create",
    title: "候选 Understanding",
    content: {
      heading: "组件边界",
      body: "把 **展示语义** 放在 `packages/ui`。",
      domainPaths: ["技术 / UI 架构"],
    },
  },
  understandingUpdate: {
    ...base,
    kind: "understanding-update",
    title: "候选修改",
    content: {
      targetLabel: "组件边界",
      beforeBody: "Renderer 持有 UI。",
      afterBody: "UI package 持有展示，Renderer 只做 Adapter。",
      reason: "降低 App 耦合。",
    },
  },
  understandingDelete: {
    ...base,
    kind: "understanding-delete",
    title: "候选删除 Understanding",
    content: { targetLabel: "过时的架构笔记", reason: "内容已合并。" },
  },
  domainCreate: {
    ...base,
    kind: "domain-create",
    title: "候选 Domain",
    content: { name: "UI 架构", parentPath: "技术" },
  },
  domainUpdate: {
    ...base,
    kind: "domain-update",
    title: "候选修改 Domain",
    content: { targetPath: "技术 / 前端", nextName: "UI 架构", nextParentPath: null },
  },
  domainDelete: {
    ...base,
    kind: "domain-delete",
    title: "候选删除 Domain",
    content: { targetPath: "旧分类", deleteUnderstandings: true },
  },
  contextCreate: {
    ...base,
    kind: "context-create",
    title: "候选 Context",
    content: {
      understandingLabel: "组件边界",
      mediumLabel: "实践",
      contextLabel: "Storybook 验收",
      body: "用独立 fixture 验收流式状态。",
    },
  },
  contextUpdate: {
    ...base,
    kind: "context-update",
    title: "候选修改 Context",
    content: {
      targetLabel: "Storybook 验收",
      nextTitle: "Storybook 状态验收",
      nextBody: "覆盖 running、completed 与 failed。",
    },
  },
  contextDelete: {
    ...base,
    kind: "context-delete",
    title: "候选删除 Context",
    content: { targetLabel: "重复记录" },
  },
  bash: {
    ...base,
    kind: "bash",
    title: "执行 Bash",
    content: { command: "bun run test", cwd: "/workspace/reflecta", timeoutMs: 30000 },
  },
  unknown: {
    ...base,
    kind: "unknown",
    title: "未来 Tool",
    content: {
      fields: [{ id: "field-1", label: "内容", value: { format: "text", value: "安全回退" } }],
    },
  },
} satisfies Record<string, AgentProposalView>;

const meta = {
  title: "Chat/Agent Proposal",
  component: AgentProposalCard,
  args: {
    proposal: proposals.understandingCreate,
    onDecision: (decision) => window.alert(JSON.stringify(decision)),
  },
} satisfies Meta<typeof AgentProposalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderstandingCreate: Story = {};
export const UnderstandingUpdate: Story = { args: { proposal: proposals.understandingUpdate } };
export const UnderstandingDelete: Story = { args: { proposal: proposals.understandingDelete } };
export const DomainCreate: Story = { args: { proposal: proposals.domainCreate } };
export const DomainUpdate: Story = { args: { proposal: proposals.domainUpdate } };
export const DomainDelete: Story = { args: { proposal: proposals.domainDelete } };
export const ContextCreate: Story = { args: { proposal: proposals.contextCreate } };
export const ContextUpdate: Story = { args: { proposal: proposals.contextUpdate } };
export const ContextDelete: Story = { args: { proposal: proposals.contextDelete } };
export const DangerousBash: Story = { args: { proposal: proposals.bash } };
export const Unknown: Story = { args: { proposal: proposals.unknown } };

const sequence = [
  {
    ...proposals.understandingCreate,
    lifecycle: "preview" as const,
    decisionEnabled: false,
    content: { heading: "组件" },
  },
  {
    ...proposals.understandingCreate,
    lifecycle: "preview" as const,
    decisionEnabled: false,
    content: { heading: "组件边界", body: "把展示语义放在 UI…" },
  },
  proposals.understandingCreate,
  {
    ...proposals.understandingCreate,
    lifecycle: "running" as const,
    decisionEnabled: false,
  },
  {
    ...proposals.understandingCreate,
    lifecycle: "completed" as const,
    decisionEnabled: false,
    note: "已写入 Understanding",
  },
];

function StreamingSequence() {
  const [frame, setFrame] = useState(0);
  return (
    <div className="grid max-w-2xl gap-3">
      <AgentProposalCard proposal={sequence[frame]} onDecision={() => undefined} />
      <button
        type="button"
        className="w-fit rounded-md border px-3 py-1.5 text-sm"
        onClick={() => setFrame((current) => (current + 1) % sequence.length)}
      >
        下一帧
      </button>
    </div>
  );
}

export const StreamingLifecycle: Story = {
  render: () => <StreamingSequence />,
};
