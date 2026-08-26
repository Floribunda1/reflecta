import type { AgentReducedAssistantBlock } from "../../../../apps/electron/src/preload/typings/agent";
import { curveEdgePath } from "../canvas/graph-document";

type ToolBlock = Extract<AgentReducedAssistantBlock, { kind: "tool" }>;

/**
 * Storybook 与完整性测试共用的工具 fixture（内容完全虚构，仅用于渲染验收）。
 * completedTools 只收录 Reflecta 真实工具面（只读 + bash + 生图 + 展示），
 * 由 tool.surface.test.ts 用 @reflecta/shared 的工具面清单做单向完整性校验。
 */

export const createdAt = new Date(Date.now() - 10_000).toISOString();

export const syntheticSections = [
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

export function syntheticMarkdown(title: string, sectionCount: number) {
  return [
    `# ${title}`,
    ...Array.from({ length: sectionCount }, (_, index) => {
      const section = syntheticSections[index % syntheticSections.length];
      return `## ${index + 1}. ${section.heading}\n\n${section.body}\n\n- 采样批次：SIM-${String(index + 1).padStart(2, "0")}\n- 复核状态：${index % 3 === 0 ? "等待下一观察窗" : "已完成交叉检查"}`;
    }),
  ].join("\n\n");
}

export function syntheticUnderstandings(count: number) {
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

export function syntheticContexts(count: number) {
  const media = ["experience", "article", "video", "ai"] as const;
  return Array.from({ length: count }, (_, index) => ({
    id: `c-sim-${index + 1}`,
    title: `第 ${index + 1} 轮联调记录`,
    content: syntheticMarkdown(`联调记录 ${index + 1}`, 1),
    medium: media[index % media.length],
  }));
}

export function syntheticCandidates(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `u-candidate-${index + 1}`,
    title: `候选策略 ${index + 1}：${syntheticSections[index % syntheticSections.length].heading}`,
    type: "understanding",
    score: Number((0.96 - index * 0.035).toFixed(3)),
    snippet: syntheticSections[index % syntheticSections.length].body,
    suggestedRead: index < 4,
    matches:
      index % 3 === 0
        ? [
            {
              entityType: "context",
              id: `c-evidence-${index + 1}`,
              medium: "experience",
              snippet: syntheticSections[(index + 2) % syntheticSections.length].body,
              channels: ["dense"],
              rank: index,
              reason: "semantic hit on Context",
            },
          ]
        : [],
  }));
}

export const mediumMarkdown = syntheticMarkdown("极地温室控制策略", 3);
export const longMarkdown = syntheticMarkdown("极地温室夜班联调纪要", 8);
export const attachmentContent = Array.from(
  { length: 240 },
  (_, index) =>
    `第 ${index + 1} 条模拟观测：${syntheticSections[index % syntheticSections.length].body} 本条记录仅用于检验长附件的折叠、展开与复制，不对应任何真实项目。`,
)
  .join("\n\n")
  .slice(0, 30_000);
export const commandOutput = Array.from(
  { length: 34 },
  (_, index) =>
    `[${String(index + 1).padStart(2, "0")}/34] zone-${(index % 8) + 1} pressure=${(1.8 + index * 0.03).toFixed(2)} temperature=${(-24 + index * 0.4).toFixed(1)} status=checked`,
).join("\n");
export const sourceFile = Array.from(
  { length: 96 },
  (_, index) =>
    `export const zone${String(index + 1).padStart(2, "0")} = { sensor: "sim-${index + 1}", threshold: ${(18 + (index % 7) * 0.5).toFixed(1)}, enabled: ${index % 5 !== 0} };`,
).join("\n");

export function tool(
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

/** 真实工具面（builtin + readonly + web + 生图 + 展示）的完成态样本；tool.surface.test.ts 校验其完整性。 */
export const completedTools: readonly ToolBlock[] = [
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
    "edit",
    {
      path: "/workspace/polar-greenhouse/apps/control/src/irrigation-zones.ts",
    },
    {
      patch:
        "--- a/irrigation-zones.ts\n+++ b/irrigation-zones.ts\n@@ -1 +1,2 @@\n-export const retryWindowMs = 8_000;\n+export const retryWindowMs = 12_000;\n+export const minimumPressureBar = 1.85;",
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
      includeMentions: true,
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
      contexts: syntheticContexts(8).map((context, index) => ({
        ...context,
        understandingId: `u-sim-${index + 1}`,
      })),
      edges: [
        { source: "u-sim-1", target: "u-sim-2" },
        { source: "u-sim-2", target: "u-sim-5" },
      ],
      page: { limit: 25, offset: 0, total: 28 },
    },
  ),
  tool(
    "understanding_list",
    {
      domainIds: ["d-irrigation"],
      includeContexts: true,
      limit: 20,
      offset: 0,
    },
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
      includeMentions: true,
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
      mentions: [
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
    "source_check",
    {
      claim: "低温下先稳定主管压力再开支路能避免错误告警",
      queries: ["polar greenhouse irrigation pressure control"],
      fetchContent: true,
    },
    {
      query: "低温下先稳定主管压力再开支路能避免错误告警",
      provider: "exa",
      results: [
        {
          rank: 1,
          url: "https://example.com/simulated-greenhouse-control",
          title: "极地温室灌溉控制实践",
          snippet: "建议先稳定主管压力，再逐步开启支路阀门。",
        },
        {
          rank: 2,
          url: "https://example.com/simulated-pressure-sequencing",
          title: "阀门顺序与压降告警",
          snippet: "晚开支路减少了瞬时压降引发的误报。",
        },
      ],
      claims: [
        {
          claim: "低温下先稳定主管压力再开支路能避免错误告警",
          status: "supported",
          rationale: "两条来源均描述先将主管压力稳定在安全区间、随后按序开启支路的做法。",
          supporting_passages: ["极地温室灌溉控制实践", "阀门顺序与压降告警"],
          contradicting_passages: [],
          confidence: 0.72,
        },
      ],
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
  tool("canvas_list", { limit: 20, offset: 0 }, [
    {
      id: "canvas-irrigation",
      title: "极地温室的分区灌溉策略",
      createdAt: "2026-07-20T01:00:00.000Z",
      updatedAt: "2026-07-29T02:00:00.000Z",
    },
    {
      id: "canvas-valve-order",
      title: "低温启动顺序画布",
      createdAt: "2026-07-18T01:00:00.000Z",
      updatedAt: "2026-07-26T02:00:00.000Z",
    },
    {
      id: "canvas-night-alerts",
      title: "夜班告警合并规则",
      createdAt: "2026-07-15T01:00:00.000Z",
      updatedAt: "2026-07-22T02:00:00.000Z",
    },
  ]),
  tool(
    "canvas_read",
    { canvasId: "canvas-irrigation", includeBodies: false },
    {
      canvas: {
        id: "canvas-irrigation",
        title: "极地温室的分区灌溉策略",
        viewport: null,
        createdAt: "2026-07-20T01:00:00.000Z",
        updatedAt: "2026-07-29T02:00:00.000Z",
      },
      elements: [
        {
          id: "elt-1",
          canvasId: "canvas-irrigation",
          parentId: null,
          x: 0,
          y: 0,
          width: 260,
          height: 180,
          zIndex: 1,
          createdAt: "2026-07-20T01:00:00.000Z",
          updatedAt: "2026-07-29T02:00:00.000Z",
          kind: "understanding",
          understandingId: "u-irrigation",
          canvasRefId: null,
          props: {},
        },
        {
          id: "elt-2",
          canvasId: "canvas-irrigation",
          parentId: null,
          x: 340,
          y: 40,
          width: 220,
          height: 120,
          zIndex: 1,
          createdAt: "2026-07-20T01:00:00.000Z",
          updatedAt: "2026-07-29T02:00:00.000Z",
          kind: "text",
          understandingId: null,
          canvasRefId: null,
          props: { text: "先稳定主管压力，再按顺序开启支路。" },
        },
      ],
      edges: [
        {
          id: "edge-1",
          canvasId: "canvas-irrigation",
          source: { cell: "elt-1", port: "right" },
          target: { cell: "elt-2", port: "left" },
          ...curveEdgePath(),
          attrs: {
            line: {
              stroke: "#3c6fb4",
              strokeWidth: 2,
              targetMarker: { name: "classic", width: 10, height: 8 },
            },
            wrap: { strokeWidth: 10 },
          },
          label: "依赖",
          createdAt: "2026-07-20T01:00:00.000Z",
        },
      ],
      understandingRefs: [
        {
          id: "u-irrigation",
          title: "极地温室的分区灌溉策略",
          body: "分区灌溉依赖阀门顺序。",
          deleted: false,
        },
      ],
      referencedCanvases: [{ id: "canvas-valve-order", title: "低温启动顺序画布", deleted: false }],
    },
  ),
  tool("canvas_search", { query: "灌溉 策略", limit: 10 }, [
    {
      canvas: { id: "canvas-irrigation", title: "极地温室的分区灌溉策略" },
      snippet: "画布内包含「先稳定主管压力」「再按顺序开启支路」等节点。",
      reason: "标题与节点文本命中",
    },
    {
      canvas: { id: "canvas-valve-order", title: "低温启动顺序画布" },
      snippet: "画布引用「极地温室的分区灌溉策略」。",
      reason: "引用命中",
    },
  ]),
];
export const failedTool = tool(
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
