import { useEffect, useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type {
  AgentReducedAssistantBlock,
  AgentReducedMessage,
} from "../../../../../apps/electron/src/preload/typings/agent";
import {
  toAgentAssistantMessageView,
  type AgentViewPresentation,
} from "../../../../../apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import { useAutoFrame } from "../../../.storybook/use-auto-frame";
import { Button } from "../../components/button";
import { ChatComposer } from "../composer/chat-composer";
import { ChatMessageRow } from "../message/chat-message-row";
import type { ChatMessageRowView } from "../message/types";

type ToolBlock = Extract<AgentReducedAssistantBlock, { kind: "tool" }>;
type ApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;
type ApprovalLifecycle = "pending" | "running" | "completed" | "rejected";

const createdAt = "2026-07-29T00:00:00.000Z";
const presentation: AgentViewPresentation = {
  entityLabels: new Map([
    ["understanding:u-irrigation", "极地温室的分区灌溉策略"],
    ["context:c-night-shift", "夜班联调记录"],
  ]),
  domainPath: (id) =>
    (
      ({
        "d-engineering": "设施工程",
        "d-irrigation": "设施工程 / 灌溉控制",
      }) as Record<string, string>
    )[id] ?? id,
};

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

const syntheticSections = [
  {
    heading: "观测条件",
    body: "极地温室外部风速持续升高，西侧种植槽的基质含水率在二十分钟内缓慢下降，但主管压力与回水槽液位没有同步异常。值班人员先核对采样时间，再使用独立探头复测，排除了单点传感器漂移。",
  },
  {
    heading: "控制策略",
    body: "系统按种植槽分配灌溉窗口。每轮先开启旁通阀，待主管压力稳定后再依次开启支路；如果相邻两次采样的压力差超过阈值，本轮只保留低流量脉冲，并将后续动作延迟到下一观察窗。",
  },
  {
    heading: "现场反馈",
    body: "操作员发现自动模式下的两条告警容易被误解为独立故障。联调时将入口温度与水泵状态合并成一条可操作提示，同时保留原始测点和状态迁移，方便事后复盘。",
  },
  {
    heading: "复验结论",
    body: "复验不以单个峰值作为结论，而是观察三十分钟移动平均。回水温度、主管压力和三个种植槽的含水率必须同时回到安全区间，任何单项越界都会触发人工复核。",
  },
  {
    heading: "遗留问题",
    body: "东侧支路在低温时仍偶发短暂通信空窗，目前没有证据表明它会导致错误灌溉。下一轮将增加阀门实际开度和本地缓存计数，以区分网络延迟与执行器迟滞。",
  },
] as const;

function syntheticMarkdown(title: string, sectionCount: number) {
  return [
    `# ${title}`,
    ...Array.from({ length: sectionCount }, (_, index) => {
      const section = syntheticSections[index % syntheticSections.length];
      return `## ${index + 1}. ${section.heading}\n\n${section.body}\n\n- 采样批次：SIM-${String(index + 1).padStart(2, "0")}\n- 复核状态：${index % 3 === 0 ? "等待下一观察窗" : "已完成交叉检查"}`;
    }),
  ].join("\n\n");
}

function syntheticUnderstandings(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `u-composition-${index + 1}`,
    title: `模拟结论 ${index + 1}：${syntheticSections[index % syntheticSections.length].heading}`,
    body: syntheticMarkdown(`模拟结论 ${index + 1}`, 1),
    domains: [{ id: "d-irrigation", name: "灌溉控制" }],
  }));
}

function syntheticContexts(count: number) {
  const media = ["experience", "article", "video", "ai"] as const;
  return Array.from({ length: count }, (_, index) => ({
    id: `c-composition-${index + 1}`,
    title: `第 ${index + 1} 轮联调记录`,
    content: syntheticMarkdown(`联调记录 ${index + 1}`, 1),
    medium: media[index % media.length],
  }));
}

const understandingOutput = {
  id: "u-irrigation",
  title: "极地温室的分区灌溉策略",
  body: syntheticMarkdown("极地温室的分区灌溉策略", 3),
  contextCount: 2,
  referenceCount: 1,
  referencedByCount: 2,
  domains: [{ id: "d-irrigation", name: "灌溉控制" }],
  contexts: syntheticContexts(2),
  relations: [
    {
      direction: "outgoing",
      targetTitle: "低温条件下的阀门启动顺序",
      rawText: "分区灌溉依赖阀门按压力稳定顺序启动。",
    },
    {
      direction: "incoming",
      sourceTitle: "夜班告警的合并规则",
      rawText: "告警展示引用了分区策略中的降级状态。",
    },
  ],
};

const retrievalOutput = {
  candidates: Array.from({ length: 10 }, (_, index) => ({
    id: `u-candidate-${index + 1}`,
    title: `候选策略 ${index + 1}：${syntheticSections[index % syntheticSections.length].heading}`,
    type: "understanding",
    score: Number((0.96 - index * 0.041).toFixed(3)),
    snippet: syntheticSections[index % syntheticSections.length].body,
    evidence: index % 3 === 0 ? "context" : "understanding",
    suggestedRead: index < 4,
    matchedContexts:
      index % 3 === 0
        ? [
            {
              id: `c-evidence-${index + 1}`,
              title: `现场证据 ${index + 1}`,
              snippet: syntheticSections[(index + 2) % syntheticSections.length].body,
              medium: "experience",
            },
          ]
        : [],
  })),
  trace: {
    strategy: "hybrid",
    searchedUnderstandings: 48,
    searchedContexts: 126,
    elapsedMs: 84,
  },
};

const domainInspectOutput = {
  domain: {
    id: "d-irrigation",
    name: "灌溉控制",
    parentId: "d-engineering",
  },
  domains: Array.from({ length: 6 }, (_, index) => ({
    id: `d-child-${index + 1}`,
    name: `模拟子领域 ${index + 1}`,
  })),
  understandings: syntheticUnderstandings(14),
  contexts: syntheticContexts(8),
  edges: [
    { source: "u-composition-1", target: "u-composition-2" },
    { source: "u-composition-2", target: "u-composition-5" },
  ],
  page: { limit: 25, offset: 0, total: 28 },
};

const telemetryOutput = Array.from(
  { length: 34 },
  (_, index) =>
    `[${String(index + 1).padStart(2, "0")}/34] zone-${(index % 8) + 1} pressure=${(1.8 + index * 0.03).toFixed(2)} temperature=${(-24 + index * 0.4).toFixed(1)} status=checked`,
).join("\n");

const attachmentContent = Array.from(
  { length: 240 },
  (_, index) =>
    `第 ${index + 1} 条模拟观测：${syntheticSections[index % syntheticSections.length].body} 本条记录只用于检验组合场景中的长附件，不对应任何真实项目。`,
)
  .join("\n\n")
  .slice(0, 30_000);

function tool(
  toolCallId: string,
  toolName: string,
  input: unknown,
  output: unknown,
  overrides: Partial<ToolBlock> = {},
): ToolBlock {
  return {
    kind: "tool",
    toolCallId,
    toolName,
    input,
    output,
    state: "completed",
    createdAt,
    ...overrides,
  };
}

function userRow(id: string, text: string): ChatMessageRowView {
  return {
    message: {
      kind: "user",
      id,
      text,
      entities: [
        {
          id: "u-irrigation",
          type: "understanding",
          label: "极地温室的分区灌溉策略",
        },
      ],
    },
    timestampLabel: "18:20",
    enabledActions: ["copy", "edit"],
  };
}

function assistantRow(
  id: string,
  blocks: AgentReducedAssistantBlock[],
  {
    running = false,
    stopped = false,
    timestampLabel,
    enabledActions = [],
  }: {
    running?: boolean;
    stopped?: boolean;
    timestampLabel?: string;
    enabledActions?: ChatMessageRowView["enabledActions"];
  } = {},
): ChatMessageRowView {
  const raw: AgentReducedMessage = {
    id,
    role: "assistant",
    text: "",
    createdAt,
    blocks,
  };
  const message = toAgentAssistantMessageView(raw, {
    assistantRunning: running,
    stopped,
    presentation,
  });
  return {
    message,
    ...(timestampLabel ? { timestampLabel } : {}),
    ...(enabledActions.length ? { enabledActions } : {}),
  };
}

const searchEntities = async () => [];

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

function StorySurface({
  children,
  className = "max-w-4xl",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto grid h-[760px] w-full ${className} grid-rows-[1fr_auto] overflow-hidden rounded-xl border bg-background shadow-sm`}
    >
      {children}
    </div>
  );
}

const typicalUnderstanding = tool(
  "typical-understanding",
  "understanding_get",
  {
    understandingId: "u-irrigation",
    includeContexts: true,
    includeRelations: true,
  },
  understandingOutput,
);

const typicalRetrieval = tool(
  "typical-retrieval",
  "retrieve_knowledge",
  {
    query: "低温环境下分区灌溉压力波动的处理方式",
    limit: 10,
  },
  retrievalOutput,
);

const typicalBashInput = {
  command:
    "bun run --cwd apps/control verify:telemetry --station polar-bay-07 --window 30m --format detailed",
  cwd: "/workspace/polar-greenhouse",
  timeoutMs: 120_000,
};

function TypicalTaskDemo() {
  const frame = useAutoFrame(4, 1_800);
  const blocks: AgentReducedAssistantBlock[] =
    frame === 0
      ? []
      : frame === 1
        ? [
            {
              kind: "reasoning",
              text: "先核对已有灌溉策略，再比较现场证据与遥测结果。",
              createdAt,
            },
          ]
        : [
            {
              kind: "reasoning",
              text: "先核对已有灌溉策略，再比较现场证据与遥测结果。",
              createdAt,
            },
            typicalUnderstanding,
            typicalRetrieval,
            tool(
              "typical-bash",
              "bash",
              typicalBashInput,
              frame === 3
                ? {
                    exitCode: 0,
                    stdout: telemetryOutput,
                    stderr: "",
                    truncated: false,
                  }
                : undefined,
              { state: frame === 3 ? "completed" : "running" },
            ),
            ...(frame === 3
              ? ([
                  {
                    kind: "text",
                    text: "检查完成：\n\n- 西侧支路的压力波动与低温启动顺序一致；\n- 十条候选理解中有四条包含现场 Context 证据；\n- 遥测校验通过，当前不需要修改控制参数。\n\n建议保留下一观察窗，确认回水温度的移动平均仍处于安全区间。",
                    state: "done",
                    createdAt,
                  },
                ] satisfies AgentReducedAssistantBlock[])
              : []),
          ];
  const row = assistantRow("typical-assistant", blocks, {
    running: frame !== 3,
    timestampLabel: frame === 3 ? "18:21" : undefined,
    enabledActions: frame === 3 ? ["copy", "fork", "regenerate"] : [],
  });

  return (
    <StorySurface>
      <div className="grid content-start gap-7 overflow-auto p-6">
        <ChatMessageRow
          row={userRow(
            "typical-user",
            "检查昨晚极地温室的压力波动，结合已有理解判断是否需要调整灌溉策略。",
          )}
        />
        <ChatMessageRow row={row} />
      </div>
      <div className="border-t bg-background p-4">
        <Composer running={frame !== 3} />
      </div>
    </StorySurface>
  );
}

function contextApproval(lifecycle: ApprovalLifecycle): ApprovalBlock {
  const completed = lifecycle === "completed";
  const approved = lifecycle === "running" || completed;
  return {
    kind: "approval",
    approvalId: "approval-context-create",
    toolCallId: "approval-context-create-tool",
    toolName: "context_create",
    title: "候选 Context",
    payload: {
      understandingId: "u-irrigation",
      medium: "experience",
      title: "夜班联调纪要",
      content: syntheticMarkdown("极地温室夜班联调纪要", 8),
    },
    ...(completed
      ? {
          output: {
            approvalStatus: "approved",
            proposalType: "context_create",
            resultRefType: "context",
            resultRefId: "c-night-shift",
            resultRefTitle: "夜班联调纪要",
          },
        }
      : {}),
    approved,
    state:
      lifecycle === "pending"
        ? "pending"
        : lifecycle === "rejected"
          ? "rejected"
          : completed
            ? "completed"
            : "approved",
    approvalState:
      lifecycle === "pending" ? "pending" : lifecycle === "rejected" ? "rejected" : "approved",
    executionState: lifecycle === "running" ? "running" : completed ? "completed" : "not_started",
    displayState:
      lifecycle === "pending"
        ? "pending_approval"
        : lifecycle === "rejected"
          ? "rejected"
          : lifecycle === "running"
            ? "running"
            : "completed",
    createdAt,
  };
}

function ApprovalTaskDemo() {
  const [lifecycle, setLifecycle] = useState<ApprovalLifecycle>("pending");

  useEffect(() => {
    if (lifecycle !== "running") return;
    const timer = window.setTimeout(() => setLifecycle("completed"), 1_200);
    return () => window.clearTimeout(timer);
  }, [lifecycle]);

  const blocks: AgentReducedAssistantBlock[] = [
    {
      kind: "reasoning",
      text: "已有策略能够解释这次波动。现场记录包含新的复验细节，适合补充为 Context。",
      createdAt,
    },
    typicalUnderstanding,
    contextApproval(lifecycle),
    ...(lifecycle === "completed" || lifecycle === "rejected"
      ? ([
          {
            kind: "text",
            text:
              lifecycle === "completed"
                ? "夜班联调纪要已经写入，原有 Understanding 保持不变。"
                : "已拒绝写入，已有理解与 Context 均未修改。",
            state: "done",
            createdAt,
          },
        ] satisfies AgentReducedAssistantBlock[])
      : []),
  ];
  const row = assistantRow("approval-assistant", blocks, {
    running: lifecycle === "pending" || lifecycle === "running",
    enabledActions:
      lifecycle === "completed" || lifecycle === "rejected" ? ["copy", "regenerate"] : [],
  });

  return (
    <StorySurface>
      <div className="grid content-start gap-7 overflow-auto p-6">
        <ChatMessageRow
          row={userRow("approval-user", "把昨晚的复验过程整理成 Context，挂到分区灌溉策略下面。")}
        />
        <ChatMessageRow
          row={row}
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

const denseBlocks: AgentReducedAssistantBlock[] = [
  {
    kind: "reasoning",
    text: "先展开领域内容和长附件，再用检索结果交叉验证；遥测命令失败后保留已完成的证据。",
    createdAt,
  },
  typicalUnderstanding,
  tool(
    "dense-domain-inspect",
    "domain_inspect",
    {
      domainId: "d-irrigation",
      includeContexts: true,
      includeRelations: true,
      limit: 25,
      offset: 0,
    },
    domainInspectOutput,
  ),
  typicalRetrieval,
  tool(
    "dense-attachment",
    "attachment_read",
    {
      attachmentId: "attachment-simulated-log",
      maxChars: 30_000,
      offset: 0,
    },
    {
      attachmentId: "attachment-simulated-log",
      filename: "polar-greenhouse-night-shift-log.txt",
      kind: "text",
      mediaType: "text/plain",
      encoding: "utf-8",
      bytes: attachmentContent.length,
      content: attachmentContent,
      truncated: true,
    },
  ),
  tool(
    "dense-bash-failed",
    "bash",
    {
      command:
        "bun run --cwd apps/control verify:telemetry --station polar-bay-07 --window 8h --strict --include pressure,temperature,flow,valve-position",
      cwd: "/workspace/polar-greenhouse",
      timeoutMs: 120_000,
    },
    undefined,
    {
      state: "failed",
      error:
        "遥测校验在等待 east-02 支路的稳定压力时超时。最近三次采样都低于安全阈值，控制程序已经停止后续阀门动作并保留现场状态。请先核对入口温度、旁通阀实际开度和压力探头时间戳，再决定是否重试。",
    },
  ),
  {
    kind: "text",
    text: "领域内容、知识检索与附件读取已经完成，但遥测校验失败，任务在汇总结论前被停止。当前证据仍然保留，可在复核设备状态后继续。",
    state: "streaming",
    createdAt,
  },
];

const denseAssistantRow = assistantRow("dense-assistant", denseBlocks, {
  stopped: true,
  enabledActions: ["copy", "regenerate"],
});

function DenseFailureDemo() {
  return (
    <StorySurface className="max-w-2xl">
      <div className="grid content-start gap-7 overflow-auto p-6">
        <ChatMessageRow
          row={userRow(
            "dense-user",
            "完整检查灌溉领域、夜班附件和遥测结果，发现异常就停止并保留已经取得的证据。",
          )}
        />
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
      description="完整对话直接消费 production message adapter；样本体量参照正式会话，业务内容与标识均为完全虚构。"
    >
      <StoryCase
        title="典型任务"
        description="自动经历等待、流式思考、多次 Tool 调用和最终回答。"
        contentClassName="p-0"
      >
        <TypicalTaskDemo />
      </StoryCase>
      <StoryCase
        title="确认任务"
        description="先读取已有 Understanding，再确认或拒绝一条生产形态的长 Context 写入。"
        contentClassName="p-0"
      >
        <ApprovalTaskDemo />
      </StoryCase>
      <StoryCase
        title="高密度与异常"
        description="领域批量结果、十条检索候选、三万字附件、长命令失败和停止状态叠加。"
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
