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

type ToolBlock = Extract<AgentReducedAssistantBlock, { kind: "tool" }>;
type ApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;

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

const syntheticSections = [
  {
    heading: "观测条件",
    body: "温室外部风速维持在每秒十八米，西侧保温帘出现间歇抖动。控制台记录到基质含水率在二十分钟内连续下降，但回水槽液位没有同步变化。值班人员先核对传感器时间戳，再用独立探头复测三个种植槽，排除了单点漂移。",
  },
  {
    heading: "控制策略",
    body: "系统按种植槽而不是整间温室分配灌溉窗口。每轮先开启回路旁通阀，待主管压力稳定后再依次开启支路；如果相邻两次采样的压力差超过阈值，本轮只保留低流量脉冲，并把后续动作延迟到下一观察窗。",
  },
  {
    heading: "现场反馈",
    body: "操作员反馈自动模式下的告警顺序容易造成误判：界面先显示水泵异常，数秒后才补充说明实际原因是入口温度过低。联调时将两条信号合并为一条可操作提示，并保留原始测点用于事后追溯。",
  },
  {
    heading: "判定依据",
    body: "本轮不追求瞬时恢复到目标值，而是观察三十分钟移动平均是否回到安全区间。只要回水温度、主管压力和三个种植槽的含水率同时满足约束，就认为策略有效；任何单项越界都会触发人工复核。",
  },
  {
    heading: "遗留问题",
    body: "东侧支路在低温时仍偶发两到三秒的通信空窗，目前没有证据表明它会造成错误灌溉。下一轮计划增加本地缓存计数和阀门实际开度采样，以区分网络延迟、执行器迟滞与传感器刷新频率不足。",
  },
  {
    heading: "复验计划",
    body: "复验分为冷启动、稳定运行和故障注入三个阶段。每个阶段保存同样的测点集合，并使用固定编号记录人工观察，避免不同班次采用不同描述。结束后只比较趋势和状态迁移，不以单个峰值作为结论。",
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
  const titles = [
    "极地温室的分区灌溉策略",
    "低温条件下的阀门启动顺序",
    "回水温度与流量补偿",
    "传感器漂移的复核方法",
    "夜班告警的合并规则",
    "故障注入期间的安全边界",
  ];
  return Array.from({ length: count }, (_, index) => ({
    id: `u-sim-${index + 1}`,
    title: titles[index % titles.length],
    body: syntheticMarkdown(`模拟结论 ${index + 1}`, 1),
    domains: [{ id: "d-irrigation", name: "灌溉控制" }],
  }));
}

function syntheticContexts(count: number) {
  const media = ["experience", "article", "video", "ai"] as const;
  return Array.from({ length: count }, (_, index) => ({
    id: `c-sim-${index + 1}`,
    title: `第 ${index + 1} 轮联调记录`,
    content: syntheticMarkdown(`联调记录 ${index + 1}`, 1),
    medium: media[index % media.length],
  }));
}

function syntheticCandidates(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `u-candidate-${index + 1}`,
    title: `候选策略 ${index + 1}：${syntheticSections[index % syntheticSections.length].heading}`,
    type: "understanding",
    score: Number((0.96 - index * 0.035).toFixed(3)),
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
  }));
}

const mediumMarkdown = syntheticMarkdown("极地温室控制策略", 3);
const longMarkdown = syntheticMarkdown("极地温室夜班联调纪要", 8);
const attachmentContent = Array.from(
  { length: 240 },
  (_, index) =>
    `第 ${index + 1} 条模拟观测：${syntheticSections[index % syntheticSections.length].body} 本条记录仅用于检验长附件的折叠、展开与复制，不对应任何真实项目。`,
)
  .join("\n\n")
  .slice(0, 30_000);
const sourceFile = Array.from(
  { length: 96 },
  (_, index) =>
    `export const zone${String(index + 1).padStart(2, "0")} = { sensor: "sim-${index + 1}", threshold: ${(18 + (index % 7) * 0.5).toFixed(1)}, enabled: ${index % 5 !== 0} };`,
).join("\n");
const commandOutput = Array.from(
  { length: 34 },
  (_, index) =>
    `[${String(index + 1).padStart(2, "0")}/34] zone-${(index % 8) + 1} pressure=${(1.8 + index * 0.03).toFixed(2)} temperature=${(-24 + index * 0.4).toFixed(1)} status=checked`,
).join("\n");

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
    {
      path: "/workspace/polar-greenhouse/apps/control/src/irrigation-zones.ts",
      offset: 1,
      limit: 120,
    },
    {
      path: "/workspace/polar-greenhouse/apps/control/src/irrigation-zones.ts",
      bytes: sourceFile.length,
      encoding: "utf-8",
      content: sourceFile,
      truncated: true,
    },
  ),
  tool(
    "file_read",
    { path: "/workspace/polar-greenhouse/docs/legacy-observation.md" },
    {
      path: "/workspace/polar-greenhouse/docs/legacy-observation.md",
      content: mediumMarkdown,
      truncated: false,
    },
    { toolCallId: "tool-file-read-legacy" },
  ),
  tool(
    "edit",
    {
      path: "/workspace/polar-greenhouse/apps/control/src/irrigation-zones.ts",
    },
    {
      patch:
        "--- a/irrigation-zones.ts\n+++ b/irrigation-zones.ts\n@@\n-export const retryWindowMs = 8_000;\n+export const retryWindowMs = 12_000;\n+export const minimumPressureBar = 1.85;",
    },
  ),
  tool(
    "write",
    {
      path: "/workspace/polar-greenhouse/artifacts/night-shift-summary.md",
      content: syntheticMarkdown("夜班摘要", 2),
    },
    { bytesWritten: 8_742 },
  ),
  tool(
    "bash",
    {
      command:
        "bun run --cwd apps/control verify:telemetry --station polar-bay-07 --window 30m --format detailed",
      cwd: "/workspace/polar-greenhouse",
      timeoutMs: 120_000,
    },
    {
      approvalStatus: "approved",
      proposalType: "bash",
      command:
        "bun run --cwd apps/control verify:telemetry --station polar-bay-07 --window 30m --format detailed",
      cwd: "/workspace/polar-greenhouse",
      exitCode: 0,
      stdout: commandOutput,
      stderr: "",
      truncated: false,
    },
  ),
  tool("domain_list", {}, [
    { id: "d-engineering", name: "设施工程" },
    { id: "d-irrigation", name: "灌溉控制", parentId: "d-engineering" },
    { id: "d-climate", name: "气候调节", parentId: "d-engineering" },
    { id: "d-energy", name: "能源管理", parentId: "d-engineering" },
    { id: "d-sensors", name: "传感器校准", parentId: "d-engineering" },
    { id: "d-operations", name: "轮班运营" },
    { id: "d-safety", name: "安全演练", parentId: "d-operations" },
    { id: "d-supplies", name: "物资补给", parentId: "d-operations" },
    { id: "d-training", name: "人员培训", parentId: "d-operations" },
    { id: "d-research", name: "实验记录" },
    { id: "d-growth", name: "作物生长", parentId: "d-research" },
    { id: "d-water", name: "水循环观测", parentId: "d-research" },
  ]),
  tool(
    "domain_inspect",
    {
      domainId: "d-irrigation",
      includeContexts: true,
      includeRelations: true,
      limit: 25,
      offset: 0,
    },
    {
      domain: {
        id: "d-irrigation",
        name: "灌溉控制",
        parentId: "d-engineering",
      },
      domains: [
        { id: "d-valves", name: "阀门控制" },
        { id: "d-pressure", name: "管路压力" },
        { id: "d-recovery", name: "回水处理" },
        { id: "d-alerts", name: "告警策略" },
        { id: "d-maintenance", name: "维护窗口" },
        { id: "d-simulation", name: "仿真演练" },
      ],
      understandings: syntheticUnderstandings(14),
      contexts: syntheticContexts(8),
      edges: [
        { source: "u-sim-1", target: "u-sim-2" },
        { source: "u-sim-2", target: "u-sim-5" },
      ],
      page: { limit: 25, offset: 0, total: 28 },
    },
  ),
  tool(
    "understanding_list",
    { domainIds: ["d-irrigation"], limit: 20, offset: 0 },
    {
      understandings: syntheticUnderstandings(12),
      contextsByUnderstandingId: Object.fromEntries(
        syntheticUnderstandings(4).map((item, index) => [item.id, syntheticContexts(index + 1)]),
      ),
    },
  ),
  tool(
    "understanding_get",
    {
      understandingId: "u-irrigation",
      includeContexts: true,
      includeRelations: true,
    },
    {
      id: "u-irrigation",
      title: "极地温室的分区灌溉策略",
      body: mediumMarkdown,
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
          rawText: "告警展示需要引用分区策略的降级状态。",
        },
      ],
    },
  ),
  tool(
    "context_list",
    { understandingId: "u-irrigation", limit: 10, offset: 0 },
    {
      contexts: syntheticContexts(7),
    },
  ),
  tool(
    "context_get",
    { contextId: "c-night-shift" },
    {
      id: "c-night-shift",
      understandingId: "u-irrigation",
      title: "夜班联调记录",
      content: syntheticMarkdown("夜班联调记录", 5),
      medium: "experience",
    },
  ),
  tool(
    "attachment_read",
    { attachmentId: "attachment-simulated-log", maxChars: 30_000, offset: 0 },
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
    "retrieve_knowledge",
    { query: "低温环境下分区灌溉压力波动的处理方式", limit: 12 },
    {
      candidates: syntheticCandidates(12),
      trace: {
        strategy: "hybrid",
        searchedUnderstandings: 48,
        searchedContexts: 126,
        elapsedMs: 84,
      },
    },
  ),
  tool(
    "graph",
    { understandingId: "u-irrigation", depth: 2 },
    {
      nodes: [
        {
          id: "u-irrigation",
          title: "极地温室的分区灌溉策略",
          body: syntheticSections[1].body,
          domains: [{ id: "d-irrigation", name: "灌溉控制" }],
        },
      ],
      edges: [],
      seed: "u-irrigation",
    },
  ),
  tool(
    "web_search",
    { query: "polar greenhouse irrigation pressure control simulation" },
    {
      results: [],
      summary: {
        text: "公开资料普遍建议在低温环境下先稳定主管压力，再逐步开启支路阀门，以避免瞬时压降触发错误告警。",
        workflow: "auto-summary",
      },
    },
  ),
  tool(
    "fetch_content",
    { urls: ["https://example.com/simulated-greenhouse-control"] },
    {
      pages: [],
      summary: "页面总结了极地温室在低温条件下进行灌溉压力控制和阀门降级的常见策略。",
    },
  ),
  tool(
    "get_search_content",
    { url: "https://example.com/simulated-greenhouse-control" },
    { content: syntheticMarkdown("公开资料摘录", 4) },
  ),
];

const failedTool = tool(
  "bash",
  {
    command:
      "bun run --cwd apps/control verify:telemetry --station polar-bay-07 --window 30m --strict",
    cwd: "/workspace/polar-greenhouse",
    timeoutMs: 120_000,
  },
  undefined,
  {
    toolCallId: "tool-bash-failed",
    state: "failed",
    error:
      "遥测校验在等待 west-03 支路的稳定压力时超时。最近三次采样都低于最低阈值，控制程序已经停止后续阀门动作并保留现场状态。",
  },
);

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
];

const streamingCommands = [
  "bun",
  "bun run --cwd apps/control",
  "bun run --cwd apps/control verify:telemetry --station polar-bay-07",
  "bun run --cwd apps/control verify:telemetry --station polar-bay-07 --window 30m",
];

function ToolCard({ block }: { block: ToolBlock }) {
  return <AgentExecutionBlock block={{ kind: "tool-activity", activity: toolActivity(block) }} />;
}

function ToolGroupCase() {
  const blocks: AgentActivityBlockView[] = [
    {
      kind: "reasoning",
      reasoning: {
        id: "reasoning-tool-group-1",
        status: "done",
        markdown: "先读取相关记录和本地配置，再核对现有知识与现场数据。",
      },
    },
    ...completedTools.slice(0, 5).map(
      (block): AgentActivityBlockView => ({
        kind: "tool-activity",
        activity: toolActivity(block),
      }),
    ),
    {
      kind: "reasoning",
      reasoning: {
        id: "reasoning-tool-group-2",
        status: "done",
        markdown: "已有信息足够，继续检查知识库、关联关系和领域结构。",
      },
    },
    ...completedTools.slice(5).map(
      (block): AgentActivityBlockView => ({
        kind: "tool-activity",
        activity: toolActivity(block),
      }),
    ),
    {
      kind: "tool-activity",
      activity: toolActivity(failedTool),
    },
    {
      kind: "reasoning",
      reasoning: {
        id: "reasoning-tool-group-3",
        status: "streaming",
        markdown: "正在汇总执行结果。",
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
    { domainIds: ["d-irrigation"], limit: 36, offset: 0 },
    {
      understandings: syntheticUnderstandings(36),
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
        title="自动流式展示"
        description="使用稳定的 toolCallId 自动补全命令，再从运行中推进到完成。"
      >
        <AutoStreamingTool />
      </StoryCase>
      <StoryCase
        title="生命周期"
        description="执行 Tool 的运行、完成、空结果与失败使用生产转换和单行状态。"
      >
        <div className="grid gap-1">
          <ToolCard block={running} />
          <ToolCard block={completedTools[4]} />
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
