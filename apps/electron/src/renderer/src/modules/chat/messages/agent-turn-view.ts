import type { AgentReducedAssistantBlock } from "@shared/agent";

export type ProposalType =
  | "understanding_create"
  | "understanding_update"
  | "understanding_delete"
  | "domain_create"
  | "domain_update"
  | "domain_delete"
  | "context_create"
  | "context_update"
  | "context_delete"
  | "bash";
export type ToolApprovalStatus = "pending" | "approved" | "rejected";
export type ToolGroupType = "lookup" | "other";
export type ProposalState =
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-denied"
  | "output-error"
  | "input-streaming";

type AgentToolBlock = Extract<AgentReducedAssistantBlock, { kind: "tool" }>;
type AgentApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;

export type ToolActivityView = {
  groupType: ToolGroupType;
  title: string;
  status: "running" | "done" | "failed";
  statusLabel: string;
  summary: string;
  items: ToolActivityItemView[];
};

export type ToolActivityItemView = {
  toolCallId: string;
  toolName: string;
  label: string;
  status: ToolActivityView["status"];
  statusLabel: string;
  errorText?: string;
};

type ProposalBase<TType extends ProposalType, TData extends { kind: string }> = {
  toolCallId: string;
  type: TType;
  title: string;
  status?: ToolApprovalStatus;
  state: ProposalState;
  errorText?: string;
  resultRefType?: string;
  resultRefId?: string;
  approvalId?: string;
  data: TData;
};

export type UnderstandingProposalView = ProposalBase<
  "understanding_create",
  {
    kind: "understanding";
    title?: string | null;
    body: string;
    domainIds: string[];
  }
>;

export type UnderstandingUpdateProposalView = ProposalBase<
  "understanding_update",
  {
    kind: "understanding-update";
    understandingId: string;
    beforeBody: string;
    afterBody: string;
    reason: string;
  }
>;

export type ContextProposalView = ProposalBase<
  "context_create",
  {
    kind: "context";
    understandingId: string;
    contextLabel: string;
    content: string;
  }
>;

export type GenericProposalView = ProposalBase<
  Exclude<ProposalType, "understanding_create" | "understanding_update" | "context_create">,
  {
    kind: "generic";
    entries: Array<{ key: string; value: string }>;
  }
>;

export type ProposalRenderData = ProposalView["data"];
export type ProposalView =
  | UnderstandingProposalView
  | UnderstandingUpdateProposalView
  | ContextProposalView
  | GenericProposalView;

export type AgentTurnBlock =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; reasoning: AgentReasoningView }
  | { kind: "tool-activity"; activity: ToolActivityView }
  | { kind: "proposal"; proposal: ProposalView };

export type AgentReasoningView = {
  text: string;
  status: "streaming" | "done";
};

export type AgentTurnView = {
  blocks: AgentTurnBlock[];
};

type InternalTurnBlock =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string; status: AgentReasoningView["status"] }
  | { kind: "tool-group"; groupType: ToolGroupType; blocks: AgentToolBlock[] }
  | { kind: "proposal"; proposal: ProposalView };

export function buildAgentTurnView(
  blocks: AgentReducedAssistantBlock[],
  assistantRunning = false,
): AgentTurnView {
  const internalBlocks: InternalTurnBlock[] = [];
  const streamingReasoningIndex =
    assistantRunning && blocks.at(-1)?.kind === "reasoning" ? blocks.length - 1 : -1;

  for (const [index, block] of blocks.entries()) {
    if (block.kind === "text") {
      appendText(internalBlocks, block.text);
      continue;
    }
    if (block.kind === "reasoning") {
      appendReasoning(
        internalBlocks,
        block.text,
        index === streamingReasoningIndex ? "streaming" : "done",
      );
      continue;
    }
    if (block.kind === "approval") {
      internalBlocks.push({ kind: "proposal", proposal: proposalViewFor(block) });
      continue;
    }
    appendTool(internalBlocks, toolGroupType(block.toolName), block);
  }

  return {
    blocks: internalBlocks.map(toPublicBlock),
  };
}

function toPublicBlock(block: InternalTurnBlock): AgentTurnBlock {
  if (block.kind === "tool-group") {
    return { kind: "tool-activity", activity: summarizeToolGroup(block.groupType, block.blocks) };
  }
  if (block.kind === "reasoning") {
    return {
      kind: "reasoning",
      reasoning: {
        text: block.text.trim(),
        status: block.status,
      },
    };
  }
  return block;
}

function appendText(blocks: InternalTurnBlock[], text: string) {
  if (!text) return;
  const last = blocks.at(-1);
  if (last?.kind === "text") {
    last.text += text;
    return;
  }
  blocks.push({ kind: "text", text });
}

function appendTool(blocks: InternalTurnBlock[], groupType: ToolGroupType, block: AgentToolBlock) {
  const last = blocks.at(-1);
  if (last?.kind === "tool-group" && last.groupType === groupType) {
    last.blocks.push(block);
    return;
  }
  blocks.push({ kind: "tool-group", groupType, blocks: [block] });
}

function appendReasoning(
  blocks: InternalTurnBlock[],
  text: string,
  status: AgentReasoningView["status"],
) {
  if (!text) return;
  const last = blocks.at(-1);
  if (last?.kind === "reasoning") {
    last.text += `\n${text}`;
    last.status = last.status === "streaming" || status === "streaming" ? "streaming" : "done";
    return;
  }
  blocks.push({ kind: "reasoning", text, status });
}

function proposalViewFor(block: AgentApprovalBlock): ProposalView {
  const input = isRecord(block.payload) ? block.payload : {};
  const output = isRecord(block.output) ? block.output : {};
  const type = proposalTypeFor(block.toolName);
  const base = {
    toolCallId: block.toolCallId,
    title: block.title || proposalTitle(type),
    status: approvalStatus(block),
    state: proposalState(block),
    errorText: block.error,
    resultRefType: stringValue(output.resultRefType),
    resultRefId: stringValue(output.resultRefId),
    approvalId: block.approvalId,
  };

  if (type === "understanding_create") {
    return { ...base, type, data: understandingProposalData(input) };
  }
  if (type === "understanding_update") {
    return { ...base, type, data: understandingUpdateProposalData(input) };
  }
  if (type === "context_create") {
    return { ...base, type, data: contextProposalData(input) };
  }
  return { ...base, type, data: genericProposalData(input) };
}

function proposalTypeFor(toolName: string): ProposalType {
  if (toolName === "understanding_create") return "understanding_create";
  if (toolName === "understanding_update") return "understanding_update";
  if (toolName === "understanding_delete") return "understanding_delete";
  if (toolName === "domain_create") return "domain_create";
  if (toolName === "domain_update") return "domain_update";
  if (toolName === "domain_delete") return "domain_delete";
  if (toolName === "context_create") return "context_create";
  if (toolName === "context_update") return "context_update";
  if (toolName === "context_delete") return "context_delete";
  if (toolName === "bash") return "bash";
  return "understanding_create";
}

function approvalStatus(block: AgentApprovalBlock): ToolApprovalStatus | undefined {
  if (block.state === "pending") return "pending";
  if (block.state === "rejected") return "rejected";
  if (block.state === "approved") return "approved";
  if (block.state === "completed") return block.approved ? "approved" : undefined;
  return block.approved ? "approved" : undefined;
}

function proposalState(block: AgentApprovalBlock): ProposalState {
  if (block.state === "pending") return "approval-requested";
  if (block.state === "approved") return "approval-responded";
  if (block.state === "rejected") return "output-denied";
  if (block.state === "completed") return "output-available";
  if (block.state === "failed") return "output-error";
  return "input-streaming";
}

function proposalTitle(type: ProposalType) {
  if (type === "understanding_create") return "候选 Understanding";
  if (type === "understanding_update") return "候选修改";
  if (type === "context_create") return "候选 Context";
  if (type === "understanding_delete") return "候选删除 Understanding";
  if (type === "domain_create") return "候选 Domain";
  if (type === "domain_update") return "候选修改 Domain";
  if (type === "domain_delete") return "候选删除 Domain";
  if (type === "context_update") return "候选修改 Context";
  if (type === "context_delete") return "候选删除 Context";
  if (type === "bash") return "执行 Bash";
  return "候选操作";
}

function understandingProposalData(
  output: Record<string, unknown>,
): UnderstandingProposalView["data"] {
  return {
    kind: "understanding",
    title: nullableStringValue(output.title),
    body: stringValue(output.body),
    domainIds: stringArray(output.domainIds),
  };
}

function understandingUpdateProposalData(
  output: Record<string, unknown>,
): UnderstandingUpdateProposalView["data"] {
  const before = isRecord(output.before) ? output.before : {};
  const after = isRecord(output.after) ? output.after : output;
  return {
    kind: "understanding-update",
    understandingId: stringValue(output.understandingId),
    beforeBody: stringValue(before.body),
    afterBody: stringValue(after.body),
    reason: stringValue(output.reason),
  };
}

function contextProposalData(output: Record<string, unknown>): ContextProposalView["data"] {
  return {
    kind: "context",
    understandingId: stringValue(output.understandingId),
    contextLabel: stringValue(output.title) || stringValue(output.medium),
    content: stringValue(output.content),
  };
}

function genericProposalData(output: Record<string, unknown>): GenericProposalView["data"] {
  return {
    kind: "generic",
    entries: Object.entries(output)
      .filter(([key, value]) => key !== "proposalType" && value !== undefined)
      .map(([key, value]) => ({ key, value: proposalValue(value) })),
  };
}

function proposalValue(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.join(", ");
  if (isRecord(value)) return JSON.stringify(value);
  return String(value);
}

function summarizeToolGroup(groupType: ToolGroupType, blocks: AgentToolBlock[]): ToolActivityView {
  const status = blocks.some((block) => block.state === "failed")
    ? "failed"
    : blocks.every((block) => block.state === "completed")
      ? "done"
      : "running";
  const title = toolActivityTitle(groupType, blocks);
  const summary =
    status === "running"
      ? runningSummary(groupType)
      : status === "failed"
        ? failedSummary(title, blocks)
        : doneSummary(groupType, blocks);

  return {
    groupType,
    title,
    status,
    statusLabel: status === "failed" ? "出错" : status === "running" ? "运行中" : "完成",
    summary,
    items: blocks.map(toolItemView),
  };
}

function toolGroupType(name: string): ToolGroupType {
  if (
    name === "search" ||
    name.startsWith("understanding_") ||
    name.startsWith("context_") ||
    name.startsWith("domain_") ||
    name === "file_read" ||
    name === "attachment_read"
  ) {
    return "lookup";
  }
  return "other";
}

function toolOutput(block: AgentToolBlock): unknown {
  return block.state === "completed" ? block.output : undefined;
}

function toolInput(block: AgentToolBlock): Record<string, unknown> {
  return isRecord(block.input) ? block.input : {};
}

function toolItemView(block: AgentToolBlock): ToolActivityItemView {
  const toolName = block.toolName;
  if (block.state === "failed") {
    return {
      toolCallId: block.toolCallId,
      toolName,
      label: `${toolDoneVerb(toolName)}失败`,
      status: "failed",
      statusLabel: "出错",
      errorText: block.error,
    };
  }
  if (block.state !== "completed") {
    return {
      toolCallId: block.toolCallId,
      toolName,
      label: toolRunningVerb(toolName),
      status: "running",
      statusLabel: "运行中",
    };
  }
  return {
    toolCallId: block.toolCallId,
    toolName,
    label: toolDoneSummary(toolName, toolInput(block), toolOutput(block)),
    status: "done",
    statusLabel: "完成",
  };
}

function runningSummary(groupType: ToolGroupType) {
  if (groupType === "lookup") return "正在查找相关内容";
  return "正在使用工具";
}

function doneSummary(groupType: ToolGroupType, blocks: AgentToolBlock[]) {
  if (blocks.length === 1 && blocks[0]) return toolItemView(blocks[0]).label;
  if (groupType === "lookup") {
    const counts = aggregateLookupCounts(blocks);
    if (counts.understandings || counts.contexts) {
      return `搜索 ${counts.understandings} 条 Understanding，读取 ${counts.contexts} 条 Context`;
    }
    return "查找了相关内容";
  }
  return "使用了工具";
}

function failedSummary(title: string, blocks: AgentToolBlock[]) {
  const failedItems = blocks.filter((block) => block.state === "failed").map(toolItemView);
  if (failedItems.length === 1) return failedItems[0]?.label ?? `${title}时遇到问题`;
  return `${title}时遇到 ${failedItems.length} 个问题`;
}

function aggregateLookupCounts(blocks: AgentToolBlock[]) {
  let understandings = 0;
  let contexts = 0;
  for (const block of blocks) {
    if (block.state !== "completed") continue;
    const name = block.toolName;
    const output = toolOutput(block);
    if (name === "understanding_list") {
      understandings += outputCount(output, "understandings");
    }
    if (name === "context_list") {
      contexts += outputCount(output, "contexts");
    }
    if (name === "search") {
      const counts = searchHitCounts(output);
      understandings += counts.understandings;
      contexts += counts.contexts;
    }
  }
  return { understandings, contexts };
}

function toolActivityTitle(groupType: ToolGroupType, blocks: AgentToolBlock[]) {
  if (blocks.length === 1 && blocks[0]) return toolTitle(blocks[0].toolName);
  if (groupType === "lookup") return "查找相关内容";
  return "使用工具";
}

function toolTitle(name: string) {
  if (name === "domain_list") return "列出 Domain";
  if (name === "domain_inspect") return "查看 Domain";
  if (name === "understanding_list") return "列出 Understanding";
  if (name === "understanding_get") return "读取 Understanding";
  if (name === "context_list") return "列出 Context";
  if (name === "context_get") return "读取 Context";
  if (name === "search") return "搜索相关内容";
  if (name === "attachment_read") return "读取附件";
  if (name === "file_read") return "读取本地文件";
  if (name === "bash") return "执行 Bash";
  return "使用工具";
}

function toolRunningVerb(name: string) {
  if (name === "attachment_read") return "正在读取附件";
  if (name === "file_read") return "正在读取本地文件";
  if (name === "bash") return "正在执行 Bash";
  if (name.includes("search")) return "正在搜索相关内容";
  if (name.includes("get")) return "正在读取内容";
  if (name.startsWith("domain_")) return "正在查看领域目录";
  return "正在使用工具";
}

function toolDoneVerb(name: string) {
  if (name === "attachment_read") return "读取附件";
  if (name === "file_read") return "读取本地文件";
  if (name === "bash") return "执行 Bash";
  if (name.includes("search")) return "搜索";
  if (name.includes("get")) return "读取";
  if (name.startsWith("domain_")) return "查看领域目录";
  return "使用工具";
}

function toolDoneSummary(name: string, input: Record<string, unknown>, output: unknown) {
  const outputRecord = isRecord(output) ? output : {};
  if (name === "file_read") {
    return `读取了「${stringValue(outputRecord.path) || stringValue(input.path) || "本地文件"}」`;
  }
  if (name === "attachment_read") {
    return `读取了「${stringValue(outputRecord.filename) || stringValue(input.attachmentId) || "附件"}」`;
  }
  if (name === "bash") {
    const exitCode = outputRecord.exitCode;
    return `执行了 Bash${typeof exitCode === "number" ? ` · exit ${exitCode}` : ""}`;
  }
  if (name === "domain_list") return `列出 ${outputCount(output, "domains")} 个 Domain`;
  if (name === "domain_inspect") {
    return `查看了「${stringValue(outputRecord.name) || stringValue(input.domainId) || "领域"}」下的内容`;
  }
  if (name === "understanding_list") {
    return `列出 ${outputCount(output, "understandings")} 条 Understanding`;
  }
  if (name === "search") {
    const counts = searchHitCounts(output);
    return `搜索了 ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context`;
  }
  if (name === "understanding_get")
    return `读取了「${entityTitle(outputRecord.understanding) || entityTitle(outputRecord) || stringValue(input.understandingId) || "Understanding"}」`;
  if (name === "context_list") return `列出 ${outputCount(output, "contexts")} 条 Context`;
  if (name === "context_get")
    return `读取了「${entityTitle(outputRecord.context) || entityTitle(outputRecord) || stringValue(input.contextId) || "Context"}」`;
  return `使用了 ${name}`;
}

function entityTitle(value: unknown) {
  if (!isRecord(value)) return undefined;
  return stringValue(value.title) || stringValue(value.name) || stringValue(value.title);
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function outputCount(output: unknown, key: string) {
  if (Array.isArray(output)) return output.length;
  return isRecord(output) ? arrayValue(output[key]).length : 0;
}

function searchHitCounts(output: unknown) {
  const hits = isRecord(output) ? arrayValue(output.hits) : [];
  let understandings = 0;
  let contexts = 0;
  for (const hit of hits) {
    if (!isRecord(hit)) continue;
    if (hit.type === "understanding") understandings += 1;
    if (hit.type === "context") contexts += 1;
  }
  return { understandings, contexts };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableStringValue(value: unknown) {
  return typeof value === "string" || value === null ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
