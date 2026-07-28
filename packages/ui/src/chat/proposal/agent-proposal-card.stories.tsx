import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../components/button";
import { AgentProposalCard } from "./agent-proposal-card";
import type { AgentProposalLifecycle, AgentProposalView } from "./types";

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
  title: "Agent/基本组件/Proposal",
  component: AgentProposalCard,
  args: {
    proposal: proposals.understandingCreate,
    onDecision: (decision) => window.alert(JSON.stringify(decision)),
  },
} satisfies Meta<typeof AgentProposalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderstandingCreate: Story = {
  name: "类型 · 新建 Understanding",
};
export const UnderstandingUpdate: Story = {
  name: "类型 · 修改 Understanding",
  args: { proposal: proposals.understandingUpdate },
};
export const UnderstandingDelete: Story = {
  name: "类型 · 删除 Understanding",
  args: { proposal: proposals.understandingDelete },
};
export const DomainCreate: Story = {
  name: "类型 · 新建 Domain",
  args: { proposal: proposals.domainCreate },
};
export const DomainUpdate: Story = {
  name: "类型 · 修改 Domain",
  args: { proposal: proposals.domainUpdate },
};
export const DomainDelete: Story = {
  name: "类型 · 删除 Domain",
  args: { proposal: proposals.domainDelete },
};
export const ContextCreate: Story = {
  name: "类型 · 新建 Context",
  args: { proposal: proposals.contextCreate },
};
export const ContextUpdate: Story = {
  name: "类型 · 修改 Context",
  args: { proposal: proposals.contextUpdate },
};
export const ContextDelete: Story = {
  name: "类型 · 删除 Context",
  args: { proposal: proposals.contextDelete },
};
export const DangerousBash: Story = {
  name: "类型 · Dangerous Bash",
  args: { proposal: proposals.bash },
};
export const Unknown: Story = {
  name: "类型 · Unknown 回退",
  args: { proposal: proposals.unknown },
};

function ProposalLifecycleDemo() {
  const [previewComplete, setPreviewComplete] = useState(false);
  const [lifecycle, setLifecycle] = useState<AgentProposalLifecycle>("preview");
  const proposal: AgentProposalView = {
    ...proposals.understandingCreate,
    lifecycle,
    decisionEnabled: lifecycle === "pending",
    content: previewComplete
      ? proposals.understandingCreate.content
      : { heading: "组件", body: "把展示语义放在…" },
    note: lifecycle === "completed" ? "已写入 Understanding" : undefined,
    error: lifecycle === "failed" ? "写入失败，请检查本地存储后重试。" : undefined,
  };

  const reset = () => {
    setPreviewComplete(false);
    setLifecycle("preview");
  };

  return (
    <div className="grid max-w-2xl gap-3">
      <AgentProposalCard
        proposal={proposal}
        onDecision={({ decision }) => setLifecycle(decision === "approve" ? "running" : "rejected")}
      />
      <div className="flex flex-wrap gap-2">
        {lifecycle === "preview" ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (previewComplete) setLifecycle("pending");
              else setPreviewComplete(true);
            }}
          >
            {previewComplete ? "进入待确认" : "补全流式预览"}
          </Button>
        ) : null}
        {lifecycle === "running" ? (
          <>
            <Button type="button" size="sm" onClick={() => setLifecycle("completed")}>
              执行完成
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setLifecycle("failed")}
            >
              执行失败
            </Button>
          </>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={reset}>
          重置
        </Button>
      </div>
    </div>
  );
}

export const StreamingLifecycle: Story = {
  name: "交互 · 流式、确认、拒绝与结果",
  render: () => <ProposalLifecycleDemo />,
};

export const DangerousBoundaries: Story = {
  name: "边界 · 超长命令与窄容器",
  args: {
    proposal: {
      ...proposals.bash,
      title: "执行一条包含大量参数和很深工作目录的危险 Bash 命令",
      content: {
        command:
          "bun run --cwd packages/ui build-storybook --debug --profile --output-dir ./artifacts/storybook-static ".repeat(
            5,
          ),
        cwd: "/Users/example/projects/reflecta/packages/ui/a/very/deep/storybook/acceptance/path",
        timeoutMs: 300_000,
      },
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
