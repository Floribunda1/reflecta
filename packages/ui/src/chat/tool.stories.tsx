import { Effect } from "effect";
import { normalizeCanvasChanges } from "@reflecta/shared";
import type { CanvasDocument } from "../canvas";
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
import { AgentActivityGroup } from "./execution/agent-activity-group";
import { AgentExecutionBlock } from "./execution/agent-execution-block";
import type { AgentActivityBlockView } from "./execution/types";
import { AgentProposalCard } from "./proposal/agent-proposal-card";
import {
  completedTools,
  failedTool,
  tool,
  createdAt,
  syntheticMarkdown,
  syntheticUnderstandings,
  syntheticContexts,
  longMarkdown,
  commandOutput,
} from "./tool-fixtures";

type ToolBlock = Extract<AgentReducedAssistantBlock, { kind: "tool" }>;
type ApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;

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

type ApprovalFixture = {
  block: ApprovalBlock;
  output: unknown;
};

/** canvas 提案草稿：host 将 Agent changes 归一化后的内部文档。 */
const canvasDraftDocument = {
  elements: [
    {
      id: "cvn-1",
      canvasId: "canvas-irrigation",
      parentId: null,
      x: 0,
      y: 0,
      width: 260,
      height: 180,
      zIndex: 1,
      createdAt,
      updatedAt: createdAt,
      kind: "understanding",
      understandingId: "u-irrigation",
      canvasRefId: null,
      props: {},
    },
    {
      id: "cvn-2",
      canvasId: "canvas-irrigation",
      parentId: null,
      x: 340,
      y: 0,
      width: 220,
      height: 120,
      zIndex: 1,
      createdAt,
      updatedAt: createdAt,
      kind: "text",
      understandingId: null,
      canvasRefId: null,
      props: { text: "线头记录\n稳定回灌依赖观察窗，而非瞬时峰值。" },
    },
  ],
  edges: [
    {
      id: "cve-1",
      canvasId: "canvas-irrigation",
      source: { cell: "cvn-1", port: "right" },
      target: { cell: "cvn-2", port: "left" },
      router: null,
      connector: { name: "reflecta-curve" },
      attrs: {
        line: {
          stroke: "#3c6fb4",
          strokeWidth: 2,
          targetMarker: { name: "classic", width: 10, height: 8 },
        },
        lines: { connection: true, strokeLinejoin: "round" },
        wrap: { strokeWidth: 10 },
      },
      label: "推导出",
      createdAt,
    },
  ],
};

const canvasCreateChanges = [
  {
    op: "add_element",
    ref: "strategy",
    element: { kind: "understanding", understandingId: "u-irrigation" },
  },
  {
    op: "add_element",
    ref: "observation",
    element: { kind: "text", text: "线头记录\n稳定回灌依赖观察窗，而非瞬时峰值。" },
  },
  {
    op: "add_edge",
    ref: "derivation",
    sourceRef: "strategy",
    targetRef: "observation",
    label: "推导出",
  },
] as const;

const canvasUpdateChanges = [
  {
    op: "update_element",
    ref: "cvn-2",
    after: { kind: "text", text: "线头记录\n稳定回灌依赖观察窗，而非瞬时峰值。" },
  },
  { op: "relayout", direction: "horizontal" },
] as const;

const canvasBeforeUpdateDocument = {
  ...canvasDraftDocument,
  elements: [
    canvasDraftDocument.elements[0],
    {
      ...canvasDraftDocument.elements[1],
      x: 0,
      y: 260,
      props: { text: "线头记录\n暂以瞬时峰值作为恢复依据。" },
    },
  ],
  edges: canvasDraftDocument.edges.map((edge) => ({
    ...edge,
    source: { ...edge.source, port: "bottom" },
    target: { ...edge.target, port: "top" },
  })),
};

const approvalTools: readonly ApprovalFixture[] = [
  {
    block: approval(
      "understanding_create",
      "候选 Understanding",
      {
        title: "低温条件下的阀门启动顺序",
        body: syntheticMarkdown("低温条件下的阀门启动顺序", 3),
        domainIds: ["d-irrigation"],
      },
      { preview: true },
    ),
    output: {
      approvalStatus: "approved",
      proposalType: "understanding_create",
      resultRefType: "understanding",
      resultRefId: "u-valve-sequence",
      resultRefTitle: "低温条件下的阀门启动顺序",
    },
  },
  {
    block: approval("understanding_update", "候选修改 Understanding", {
      understandingId: "u-irrigation",
      before: {
        title: "极地温室的分区灌溉策略",
        body: syntheticMarkdown("修订前策略", 2),
        domainIds: ["d-irrigation"],
      },
      after: {
        title: "极地温室的分区灌溉与降级策略",
        body: syntheticMarkdown("修订后策略", 4),
        domainIds: ["d-irrigation"],
      },
      reason:
        "连续三轮故障注入都表明，主管压力恢复需要比原计划更长的观察窗，因此补充分区降级条件和人工复核入口。",
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "understanding_update",
      resultRefType: "understanding",
      resultRefId: "u-irrigation",
      resultRefTitle: "极地温室的分区灌溉与降级策略",
    },
  },
  {
    block: approval(
      "understanding_update",
      "候选修改 Understanding",
      {
        understandingId: "u-valve-sequence",
        before: {
          title: "低温条件下的阀门启动顺序",
          body: syntheticMarkdown("低温条件下的阀门启动顺序", 2),
          domainIds: ["d-irrigation"],
        },
        domainIds: ["d-engineering"],
        reason: "阀门启动结论属于设施工程共性问题，不再局限于灌溉子系统，移到上级 Domain。",
      },
      {
        approvalId: "approval-understanding-update-move",
        toolCallId: "approval-tool-understanding-update-move",
      },
    ),
    output: {
      approvalStatus: "approved",
      proposalType: "understanding_update",
      resultRefType: "understanding",
      resultRefId: "u-valve-sequence",
      resultRefTitle: "低温条件下的阀门启动顺序",
    },
  },
  {
    block: approval("understanding_delete", "候选删除 Understanding", {
      understandingId: "u-obsolete-sensor",
      reason:
        "这条结论只适用于已经退役的第一代探头，当前校准流程不会再引用它，历史数据已经保留在实验归档中。",
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "understanding_delete",
      resultRefType: "understanding",
      resultRefId: "u-obsolete-sensor",
    },
  },
  {
    block: approval("domain_create", "候选 Domain", {
      name: "故障注入",
      parentId: "d-engineering",
      reason: "集中记录演练条件、预期降级行为和复验结论。",
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "domain_create",
      resultRefType: "domain",
      resultRefId: "d-fault-injection",
    },
  },
  {
    block: approval("domain_update", "候选修改 Domain", {
      domainId: "d-irrigation",
      before: {
        name: "灌溉控制",
        parentId: "d-engineering",
      },
      name: "灌溉与回水控制",
      parentId: "d-engineering",
      reason: "现有记录已经同时覆盖供水和回水，原名称无法准确表达边界。",
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "domain_update",
      resultRefType: "domain",
      resultRefId: "d-irrigation",
    },
  },
  {
    block: approval("domain_delete", "候选删除 Domain", {
      domainId: "d-retired-prototype",
      deleteUnderstandings: false,
      reason: "原型设备已经拆除，仍有价值的结论会保留并迁移到设施工程。",
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "domain_delete",
      resultRefType: "domain",
      resultRefId: "d-retired-prototype",
    },
  },
  {
    block: approval("context_create", "候选 Context", {
      understandingId: "u-irrigation",
      medium: "experience",
      title: "夜班联调纪要",
      content: longMarkdown,
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "context_create",
      resultRefType: "context",
      resultRefId: "c-night-shift-2",
      resultRefTitle: "夜班联调纪要",
    },
  },
  {
    block: approval("context_update", "候选修改 Context", {
      contextId: "c-night-shift",
      before: {
        understandingId: "u-irrigation",
        medium: "experience",
        title: "夜班联调记录",
        content: syntheticMarkdown("夜班联调记录", 4),
      },
      understandingId: "u-irrigation",
      medium: "ai",
      title: "夜班联调记录（复核版）",
      content: syntheticMarkdown("夜班联调记录（复核版）", 6),
      reason: "补充独立探头的复测结果，并将未经验证的原因判断改为待确认假设。",
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "context_update",
      resultRefType: "context",
      resultRefId: "c-night-shift",
      resultRefTitle: "夜班联调记录（复核版）",
    },
  },
  {
    block: approval("context_delete", "候选删除 Context", {
      contextId: "c-duplicate-log",
      reason: "同一班次的设备日志被重复导入，校验和与已有记录一致。",
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "context_delete",
      resultRefType: "context",
      resultRefId: "c-duplicate-log",
    },
  },
  {
    block: approval("bash", "确认危险 Bash", {
      command:
        "bun run --cwd apps/control inject:fault --station polar-bay-07 --zone west-03 --signal inlet-temperature --value -38 --duration 90s",
      cwd: "/workspace/polar-greenhouse",
      timeoutMs: 120_000,
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "bash",
      exitCode: 0,
      stdout: commandOutput,
      stderr: "",
      truncated: false,
    },
  },
  {
    block: approval("canvas_create", "候选画布", {
      title: "极地温室的分区灌溉策略",
      changes: canvasCreateChanges,
      layout: "auto",
      document: canvasDraftDocument,
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "canvas_create",
      resultRefType: "canvas",
      resultRefId: "canvas-irrigation",
      resultRefTitle: "极地温室的分区灌溉策略",
    },
  },
  {
    block: approval("canvas_update", "候选修改画布", {
      canvasId: "canvas-irrigation",
      changes: canvasUpdateChanges,
      reason: "把昨夜复验的推导链显式画出来，用户据此验收结构与缺失。",
      before: {
        title: "分区灌溉策略画布",
        document: canvasBeforeUpdateDocument,
      },
      document: canvasDraftDocument,
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "canvas_update",
      resultRefType: "canvas",
      resultRefId: "canvas-irrigation",
      resultRefTitle: "分区灌溉策略画布",
    },
  },
  {
    block: approval("canvas_delete", "候选删除画布", {
      canvasId: "canvas-irrigation",
      reason: "复验结论已并入主策略画布，删除旧版避免双源。",
    }),
    output: {
      approvalStatus: "approved",
      proposalType: "canvas_delete",
      resultRefType: "canvas",
      resultRefId: "canvas-irrigation",
    },
  },
];

const approvedExecutionFailure = approval(
  "understanding_update",
  "修改 Understanding",
  {
    understandingId: "u-irrigation",
    before: {
      title: "极地温室的分区灌溉策略",
      body: syntheticMarkdown("修订前策略", 2),
      domainIds: ["d-irrigation"],
    },
    after: {
      title: "极地温室的分区灌溉与降级策略",
      body: syntheticMarkdown("修订后策略", 3),
      domainIds: ["d-irrigation"],
    },
    reason: "补充分区降级条件和人工复核入口。",
  },
  {
    approvalId: "approval-understanding-update-failed",
    toolCallId: "approval-tool-understanding-update-failed",
    approved: true,
    state: "failed",
    approvalState: "approved",
    executionState: "failed",
    displayState: "failed",
    error: "写入 Understanding 失败：目标版本已发生变化，请重新读取后再确认。",
    executionError: {
      message: "写入 Understanding 失败：目标版本已发生变化，请重新读取后再确认。",
    },
  },
);

const streamingCommands = [
  "bun",
  "bun run --cwd apps/control",
  "bun run --cwd apps/control verify:telemetry --station polar-bay-07",
  "bun run --cwd apps/control verify:telemetry --station polar-bay-07 --window 30m",
];

function ToolCard({ block }: { block: ToolBlock }) {
  return <AgentExecutionBlock block={{ kind: "tool-activity", activity: toolActivity(block) }} />;
}

function ActivityGroupLifecycle() {
  const [running, setRunning] = useState(true);
  // 前面块已完成，只有最后一个块在运行/收尾。
  const blocks: AgentActivityBlockView[] = [
    {
      kind: "reasoning",
      reasoning: {
        id: "reasoning-lifecycle-1",
        status: "done",
        markdown: "已核对现场记录、本地配置与知识库。",
        createdAt: new Date(Date.now() - 5_000).toISOString(),
      },
    },
    ...completedTools.slice(0, 3).map((block): AgentActivityBlockView => ({
      kind: "tool-activity",
      activity: toolActivity(block),
    })),
    {
      kind: "reasoning",
      reasoning: {
        id: "reasoning-lifecycle-2",
        status: running ? "streaming" : "done",
        markdown: running ? "正在汇总 Tool 的执行结果…" : "汇总完成，给出结论。",
      },
    },
  ];

  return (
    <div className="grid max-w-4xl gap-4">
      <AgentActivityGroup blocks={blocks} />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setRunning((current) => !current)}>
          {running ? "模拟完成" : "重新运行"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {running ? "运行中：组强制展开，手动收起会被覆盖" : "已完成：默认收成一行，可手动展开"}
        </span>
      </div>
    </div>
  );
}

function ToolGroupCase() {
  const streamingReasoning = [
    "正在汇总",
    "正在汇总 Tool 的执行结果",
    "正在汇总 Tool 的执行结果，并检查失败步骤。",
  ][useAutoFrame(3)];
  const blocks: AgentActivityBlockView[] = [
    {
      kind: "reasoning",
      reasoning: {
        id: "reasoning-tool-group-1",
        status: "done",
        markdown: "先读取相关记录和本地配置，再核对现有知识与现场数据。",
      },
    },
    ...completedTools.slice(0, 5).map((block): AgentActivityBlockView => ({
      kind: "tool-activity",
      activity: toolActivity(block),
    })),
    {
      kind: "reasoning",
      reasoning: {
        id: "reasoning-tool-group-2",
        status: "done",
        markdown: "已有信息足够，继续检查知识库、关联关系和领域结构。",
      },
    },
    ...completedTools.slice(5).map((block): AgentActivityBlockView => ({
      kind: "tool-activity",
      activity: toolActivity(block),
    })),
    {
      kind: "tool-activity",
      activity: toolActivity(failedTool),
    },
    {
      kind: "reasoning",
      reasoning: {
        id: "reasoning-tool-group-3",
        status: "streaming",
        markdown: streamingReasoning,
      },
    },
  ];

  return (
    <div className="max-w-4xl">
      <AgentActivityGroup blocks={blocks} />
    </div>
  );
}

function AutoStreamingTool() {
  const frame = useAutoFrame(streamingCommands.length);
  const completed = frame === streamingCommands.length - 1;
  const block = tool(
    "bash",
    {
      command: streamingCommands[frame],
      cwd: "/workspace/polar-greenhouse",
    },
    completed ? { exitCode: 0, stdout: commandOutput, stderr: "", truncated: false } : undefined,
    {
      toolCallId: "tool-auto-streaming",
      state: completed ? "completed" : "running",
    },
  );

  return <ToolCard block={block} />;
}

function CanvasStreamingProposalCard() {
  const complete = useAutoFrame(2) === 1;
  // 与 Agent 生成文档 case 同管道：changes 现场走 normalizeCanvasChanges（ELK）生成几何，
  // 不手写静态草稿——流式完成后统一水合一次，水合完成前保持骨架。
  const [document, setDocument] = useState<CanvasDocument | null>(null);
  useEffect(() => {
    let mounted = true;
    const promise = Effect.runPromise(
      normalizeCanvasChanges({ layout: "auto", changes: canvasCreateChanges }),
    ).then((result) => {
      if (mounted) setDocument(result.document);
    });
    return () => {
      mounted = false;
      promise.catch(() => undefined);
    };
  }, []);
  const block = approval(
    "canvas_create",
    "候选画布",
    complete && document
      ? {
          title: "极地温室的分区灌溉策略",
          changes: canvasCreateChanges,
          layout: "auto",
          document,
        }
      : {
          title: "极地温室的分区灌溉策略",
          changes: canvasCreateChanges,
          layout: "auto",
        },
    { approvalId: "approval-canvas-streaming", preview: true },
  );

  return (
    <div className="grid min-w-0 gap-1">
      <code className="px-3 text-xs text-muted-foreground">
        canvas_create ·{" "}
        {complete
          ? document
            ? "参数完整，草稿已水合"
            : "参数完整，水合中…"
          : "参数流式中（骨架 loading）"}
      </code>
      <AgentProposalCard proposal={proposalView(block)} />
    </div>
  );
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
        onDecision={(result) =>
          setBlock((current) =>
            result.decision === "approve"
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
                  ...(result.reason ? { rejectionReason: result.reason } : {}),
                },
          )
        }
      />
    </div>
  );
}

function ToolGallery() {
  const [proposalGeneration, setProposalGeneration] = useState(0);
  const running = tool(
    "bash",
    {
      command: "bun run --cwd apps/control verify:telemetry --station polar-bay-07",
      cwd: "/workspace/polar-greenhouse",
    },
    undefined,
    { toolCallId: "tool-bash-running", state: "running" },
  );
  const manyResults = tool(
    "understanding_list",
    {
      domainIds: ["d-irrigation"],
      includeContexts: true,
      limit: 36,
      offset: 0,
    },
    {
      understandings: syntheticUnderstandings(36),
      contextsByUnderstandingId: Object.fromEntries(
        syntheticUnderstandings(4).map((item, index) => [item.id, syntheticContexts(index + 1)]),
      ),
    },
  );
  const emptyResults = tool(
    "understanding_list",
    { domainIds: ["d-irrigation"], limit: 20, offset: 0 },
    { understandings: [] },
    { toolCallId: "tool-understanding-list-empty" },
  );
  const longCommand = tool(
    "bash",
    {
      command:
        "bun run --cwd apps/control simulate:night-shift --station polar-bay-07 --zones west-01,west-02,west-03,east-01,east-02 --include pressure,temperature,flow,valve-position --window 8h --sample-interval 5s --output ./artifacts/simulations/2026-07-29/night-shift-detailed-observation.json",
      cwd: "/workspace/polar-greenhouse/apps/control/simulations/acceptance/fixtures/very-deep-directory",
    },
    {
      exitCode: 0,
      stdout: Array.from(
        { length: 96 },
        (_, index) =>
          `[${String(index + 1).padStart(2, "0")}/96] zone-${(index % 8) + 1} sample accepted · pressure=${(1.7 + index * 0.012).toFixed(3)}bar · temperature=${(-31 + index * 0.11).toFixed(2)}°C`,
      ).join("\n"),
      stderr: "",
      truncated: true,
    },
  );

  return (
    <StoryShowcase
      title="Tool"
      description="集中验收所有 production Tool 的完成、确认、拒绝、自动流式、失败和极端内容状态。样本体量参照正式会话，业务内容与标识均为完全虚构。"
    >
      <StoryCase title="Tool Group">
        <ToolGroupCase />
      </StoryCase>
      <StoryCase
        title="活动组生命周期"
        description="同一组块连续操作：运行中强制展开（手动收起被覆盖）→ 模拟完成 → 默认收成一行。"
      >
        <ActivityGroupLifecycle />
      </StoryCase>
      <StoryCase
        title="自动流式展示"
        description="使用稳定的 toolCallId 自动补全命令，再从运行中推进到完成。"
      >
        <AutoStreamingTool />
      </StoryCase>
      <StoryCase
        title="Canvas 提案草稿水合"
        description="参数流式期间只发一次原始 preview（骨架 loading），参数完整后统一水合一次并渲染完整草稿——不再逐 chunk 归一化累计 changes。"
      >
        <CanvasStreamingProposalCard />
      </StoryCase>
      <StoryCase
        title="生命周期"
        description="执行 Tool 的运行、完成、空结果与失败使用生产转换和单行状态。"
      >
        <div className="grid gap-1">
          <ToolCard block={running} />
          <ToolCard block={completedTools.find((block) => block.toolName === "bash")!} />
          <ToolCard block={emptyResults} />
          <ToolCard block={failedTool} />
        </div>
      </StoryCase>
      <StoryCase title="生产类型图谱" description="以下状态行走 production 的 runtime 转换函数。">
        <div className="grid gap-1">
          {completedTools.map((block) => (
            <div key={block.toolCallId}>
              <ToolCard block={block} />
            </div>
          ))}
        </div>
      </StoryCase>
      <StoryCase
        title="需要确认的 Tool"
        description="确认后自动进入执行中并完成；拒绝后直接显示 production 拒绝态。"
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
        <div key={proposalGeneration} className="grid gap-4">
          {approvalTools.map((fixture) => (
            <div key={fixture.block.approvalId}>
              <InteractiveProposalCard fixture={fixture} />
            </div>
          ))}
        </div>
      </StoryCase>
      <StoryCase
        title="确认后执行失败"
        description="审批已经通过，但实际写入失败；审批状态与执行状态同时保留。"
      >
        <div className="grid min-w-0 gap-1">
          <code className="px-3 text-xs text-muted-foreground">
            {approvedExecutionFailure.toolName}
          </code>
          <AgentProposalCard proposal={proposalView(approvedExecutionFailure)} />
        </div>
      </StoryCase>
      <StoryCase
        title="异常与边界"
        description="长命令、深路径、大量输出和大量结果仍然使用实际生产 Tool。"
        contentClassName="grid gap-4"
      >
        <div className="grid gap-4">
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
