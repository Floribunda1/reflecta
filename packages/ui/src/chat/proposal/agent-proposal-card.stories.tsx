import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import { Button } from "../../components/button";
import { AgentProposalCard } from "./agent-proposal-card";
import type { AgentProposalView } from "./types";

const base = {
  id: "proposal-1",
  title: "新增 Understanding：低温灌溉窗口",
  decisionEnabled: true,
};

const previewProposal: AgentProposalView = {
  ...base,
  lifecycle: "preview",
  kind: "understanding-create",
  content: { heading: "低温灌溉窗口", body: "" },
};

const pendingProposal: AgentProposalView = {
  ...base,
  lifecycle: "pending",
  kind: "understanding-create",
  content: {
    heading: "低温灌溉窗口",
    body: "不同种植槽根据基质含水率、回水温度和主管压力获得独立灌溉窗口。",
    domainPaths: ["产品", "用户研究"],
  },
};

const runningProposal: AgentProposalView = {
  ...base,
  lifecycle: "running",
  kind: "understanding-create",
  content: {
    heading: "低温灌溉窗口",
    body: "不同种植槽根据基质含水率、回水温度和主管压力获得独立灌溉窗口。",
  },
};

const completedProposal: AgentProposalView = {
  ...base,
  lifecycle: "completed",
  kind: "understanding-create",
  content: {
    heading: "低温灌溉窗口",
    body: "不同种植槽根据基质含水率、回水温度和主管压力获得独立灌溉窗口。",
  },
};

const rejectedProposal: AgentProposalView = {
  ...base,
  lifecycle: "rejected",
  rejectionReason: "与现有「夜间保温」理解范围重叠，建议先合并再评审。",
  kind: "understanding-create",
  content: { heading: "低温灌溉窗口", body: "不同种植槽根据基质含水率获得独立灌溉窗口。" },
};

const failedProposal: AgentProposalView = {
  ...base,
  lifecycle: "failed",
  error: "生成内容时模型超时，请重试。",
  kind: "understanding-create",
  content: { heading: "低温灌溉窗口", body: "" },
};

const updateProposal: AgentProposalView = {
  id: "proposal-2",
  title: "修改 Understanding：低温灌溉窗口",
  lifecycle: "pending",
  decisionEnabled: true,
  kind: "understanding-update",
  content: {
    targetLabel: "低温灌溉窗口",
    beforeHeading: "低温灌溉策略",
    afterHeading: "低温灌溉窗口",
    beforeBody: "根据回水温度调整灌溉时长。",
    afterBody: "根据基质含水率、回水温度和主管压力获得独立灌溉窗口。",
    beforeDomainPaths: ["技术"],
    domainPaths: ["技术", "实践与复盘"],
    reason: "灌溉窗口的触发条件比原描述更具体，且新增了实践域归属。",
  },
};

const deleteProposal: AgentProposalView = {
  id: "proposal-3",
  title: "删除 Understanding：过时的保温策略",
  lifecycle: "pending",
  decisionEnabled: true,
  kind: "understanding-delete",
  content: { targetLabel: "过时的保温策略", reason: "已被「夜间保温」覆盖。" },
};

const bashProposal: AgentProposalView = {
  id: "proposal-4",
  title: "执行 Bash",
  lifecycle: "running",
  kind: "bash",
  content: {
    cwd: "/Users/reflecta/control",
    timeoutMs: 30_000,
    command: "node scripts/irrigation-summary.mjs --zones=all",
  },
};

const unknownProposal: AgentProposalView = {
  id: "proposal-5",
  title: "未知操作",
  lifecycle: "pending",
  decisionEnabled: true,
  kind: "unknown",
  content: {
    fields: [
      { id: "f1", label: "操作", value: { format: "text", value: "更新调度表" } },
      { id: "f2", label: "目标", value: { format: "pre", value: "schedules/weekly.json" } },
    ],
  },
};

function LifecycleInteractive() {
  const [lifecycle, setLifecycle] = useState<AgentProposalView["lifecycle"]>("pending");
  const [rejectionReason, setRejectionReason] = useState<string | undefined>();
  const proposal: AgentProposalView = {
    ...pendingProposal,
    id: "proposal-interactive",
    lifecycle,
    rejectionReason,
  };
  return (
    <div className="grid gap-4">
      <AgentProposalCard
        proposal={proposal}
        onDecision={(d) => {
          if (d.decision === "approve") {
            setLifecycle("running");
          } else {
            setLifecycle("rejected");
            setRejectionReason(d.reason);
          }
        }}
      />
      {lifecycle === "running" ? (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setLifecycle("completed")}>
            模拟执行完成
          </Button>
          <span className="text-xs text-muted-foreground">当前生命周期：running</span>
        </div>
      ) : null}
      <p className="px-2 text-xs text-muted-foreground">
        当前生命周期：{lifecycle}
        {rejectionReason ? ` · 拒绝理由：${rejectionReason}` : ""}
      </p>
    </div>
  );
}

function ProposalShowcase() {
  const withDecision = (proposal: AgentProposalView) => (
    <AgentProposalCard proposal={proposal} onDecision={() => undefined} />
  );

  return (
    <StoryShowcase
      title="Proposal Card"
      description="验收知识变更提案的完整生命周期、各类型内容变体与审批交互。"
    >
      <StoryCase
        title="生命周期"
        description="preview → pending → running → completed / rejected / failed 连续比较；pending 提供确认与拒绝入口。"
      >
        <div className="grid gap-4">
          {withDecision(previewProposal)}
          {withDecision(pendingProposal)}
          {withDecision(runningProposal)}
          {withDecision(completedProposal)}
          {withDecision(rejectedProposal)}
          {withDecision(failedProposal)}
        </div>
      </StoryCase>

      <StoryCase
        title="类型与内容变体"
        description="新增、修改（前后对比）、删除、Bash 命令与未知操作的字段结构各自成立。"
      >
        <div className="grid gap-4">
          {withDecision(updateProposal)}
          {withDecision(deleteProposal)}
          {withDecision(bashProposal)}
          {withDecision(unknownProposal)}
        </div>
      </StoryCase>

      <StoryCase
        title="审批交互"
        description="同一张卡可操作推进：确认 → running → 模拟完成；拒绝（含理由）→ rejected。"
      >
        <LifecycleInteractive />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/基本组件",
  component: AgentProposalCard,
  args: {
    proposal: pendingProposal,
    onDecision: () => undefined,
  },
} satisfies Meta<typeof AgentProposalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProposalCardStory: Story = {
  name: "Proposal Card",
  render: () => <ProposalShowcase />,
};
