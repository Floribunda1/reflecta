import type { AgentReducedAssistantBlock } from "@shared/agent";

export type ProposalType =
  | "thought_create"
  | "thought_update"
  | "thought_delete"
  | "category_create"
  | "category_update"
  | "category_delete"
  | "context_create"
  | "context_update"
  | "context_delete"
  | "bash";
export type ToolApprovalStatus = "pending" | "approved" | "rejected";
export type ToolGroupType = "lookup" | "graph" | "other";
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

export type ThoughtProposalView = ProposalBase<
  "thought_create",
  {
    kind: "thought";
    title?: string | null;
    body: string;
    categoryIds: string[];
  }
>;

export type ThoughtUpdateProposalView = ProposalBase<
  "thought_update",
  {
    kind: "thought-update";
    thoughtId: string;
    beforeBody: string;
    afterBody: string;
    reason: string;
  }
>;

export type ContextProposalView = ProposalBase<
  "context_create",
  {
    kind: "context";
    thoughtId: string;
    sourceLabel: string;
    content: string;
  }
>;

export type GenericProposalView = ProposalBase<
  Exclude<ProposalType, "thought_create" | "thought_update" | "context_create">,
  {
    kind: "generic";
    entries: Array<{ key: string; value: string }>;
  }
>;

export type ProposalRenderData = ProposalView["data"];
export type ProposalView =
  | ThoughtProposalView
  | ThoughtUpdateProposalView
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

  for (const block of blocks) {
    if (block.kind === "text") {
      appendText(internalBlocks, block.text);
      continue;
    }
    if (block.kind === "reasoning") {
      appendReasoning(internalBlocks, block.text, assistantRunning ? "streaming" : "done");
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

  if (type === "thought_create") {
    return { ...base, type, data: thoughtProposalData(input) };
  }
  if (type === "thought_update") {
    return { ...base, type, data: thoughtUpdateProposalData(input) };
  }
  if (type === "context_create") {
    return { ...base, type, data: contextProposalData(input) };
  }
  return { ...base, type, data: genericProposalData(input) };
}

function proposalTypeFor(toolName: string): ProposalType {
  if (toolName === "thought_create") return "thought_create";
  if (toolName === "thought_update") return "thought_update";
  if (toolName === "thought_delete") return "thought_delete";
  if (toolName === "category_create") return "category_create";
  if (toolName === "category_update") return "category_update";
  if (toolName === "category_delete") return "category_delete";
  if (toolName === "context_create") return "context_create";
  if (toolName === "context_update") return "context_update";
  if (toolName === "context_delete") return "context_delete";
  if (toolName === "bash") return "bash";
  return "thought_create";
}

function approvalStatus(block: AgentApprovalBlock): ToolApprovalStatus | undefined {
  if (block.state === "pending") return "pending";
  if (block.state === "rejected") return "rejected";
  if (block.state === "approved" || block.state === "completed") return "approved";
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
  if (type === "thought_create") return "候选 Thought";
  if (type === "thought_update") return "候选修改";
  if (type === "context_create") return "候选 Context";
  if (type === "thought_delete") return "候选删除 Thought";
  if (type === "category_create") return "候选 Category";
  if (type === "category_update") return "候选修改 Category";
  if (type === "category_delete") return "候选删除 Category";
  if (type === "context_update") return "候选修改 Context";
  if (type === "context_delete") return "候选删除 Context";
  if (type === "bash") return "执行 Bash";
  return "候选操作";
}

function thoughtProposalData(output: Record<string, unknown>): ThoughtProposalView["data"] {
  return {
    kind: "thought",
    title: nullableStringValue(output.title),
    body: stringValue(output.body),
    categoryIds: stringArray(output.categoryIds),
  };
}

function thoughtUpdateProposalData(
  output: Record<string, unknown>,
): ThoughtUpdateProposalView["data"] {
  const before = isRecord(output.before) ? output.before : {};
  const after = isRecord(output.after) ? output.after : output;
  return {
    kind: "thought-update",
    thoughtId: stringValue(output.thoughtId),
    beforeBody: stringValue(before.body),
    afterBody: stringValue(after.body),
    reason: stringValue(output.reason),
  };
}

function contextProposalData(output: Record<string, unknown>): ContextProposalView["data"] {
  return {
    kind: "context",
    thoughtId: stringValue(output.thoughtId),
    sourceLabel: stringValue(output.sourceName) || stringValue(output.sourceType),
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
  if (name.startsWith("graph_")) return "graph";
  if (
    name.startsWith("search_") ||
    name.startsWith("thought_") ||
    name.startsWith("context_") ||
    name.startsWith("category_") ||
    name === "file_read" ||
    name === "attachment_read" ||
    name === "snapshot_project"
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
  if (groupType === "graph") return "正在查看关联";
  if (groupType === "lookup") return "正在查找相关内容";
  return "正在使用工具";
}

function doneSummary(groupType: ToolGroupType, blocks: AgentToolBlock[]) {
  if (blocks.length === 1 && blocks[0]) return toolItemView(blocks[0]).label;
  if (groupType === "graph") return "查看了关联";
  if (groupType === "lookup") {
    const counts = aggregateLookupCounts(blocks);
    if (counts.thoughts || counts.contexts) {
      return `搜索 ${counts.thoughts} 条 Thought，读取 ${counts.contexts} 条 Context`;
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
  let thoughts = 0;
  let contexts = 0;
  for (const block of blocks) {
    if (block.state !== "completed") continue;
    const name = block.toolName;
    const output = toolOutput(block);
    if (name === "thought_list" || name === "search_thoughts") {
      thoughts += outputCount(output, "thoughts");
    }
    if (name === "context_list" || name === "search_contexts") {
      contexts += outputCount(output, "contexts");
    }
    if (name === "search_all") {
      thoughts += outputCount(output, "thoughts");
      contexts += outputCount(output, "contexts");
    }
  }
  return { thoughts, contexts };
}

function toolActivityTitle(groupType: ToolGroupType, blocks: AgentToolBlock[]) {
  if (blocks.length === 1 && blocks[0]) return toolTitle(blocks[0].toolName);
  if (groupType === "graph") return "查看关联";
  if (groupType === "lookup") return "查找相关内容";
  return "使用工具";
}

function toolTitle(name: string) {
  if (name === "snapshot_project") return "查看知识库概览";
  if (name === "category_list") return "列出 Category";
  if (name === "category_inspect") return "查看 Category";
  if (name === "thought_list") return "列出 Thought";
  if (name === "thought_get") return "读取 Thought";
  if (name === "context_list") return "列出 Context";
  if (name === "context_get") return "读取 Context";
  if (name === "search_thoughts") return "搜索 Thought";
  if (name === "search_contexts") return "搜索 Context";
  if (name === "search_all") return "搜索相关内容";
  if (name === "attachment_read") return "读取附件";
  if (name === "file_read") return "读取本地文件";
  if (name === "bash") return "执行 Bash";
  if (name.startsWith("graph_")) return "查看关联";
  return "使用工具";
}

function toolRunningVerb(name: string) {
  if (name === "attachment_read") return "正在读取附件";
  if (name === "file_read") return "正在读取本地文件";
  if (name === "bash") return "正在执行 Bash";
  if (name.startsWith("graph_")) return "正在查看关联";
  if (name.includes("search")) return "正在搜索相关内容";
  if (name.includes("get")) return "正在读取内容";
  if (name.startsWith("category_")) return "正在查看领域目录";
  if (name === "snapshot_project") return "正在查看知识库概览";
  return "正在使用工具";
}

function toolDoneVerb(name: string) {
  if (name === "attachment_read") return "读取附件";
  if (name === "file_read") return "读取本地文件";
  if (name === "bash") return "执行 Bash";
  if (name.startsWith("graph_")) return "查看关联";
  if (name.includes("search")) return "搜索";
  if (name.includes("get")) return "读取";
  if (name.startsWith("category_")) return "查看领域目录";
  if (name === "snapshot_project") return "查看知识库概览";
  return "使用工具";
}

function toolDoneSummary(name: string, input: Record<string, unknown>, output: unknown) {
  const outputRecord = isRecord(output) ? output : {};
  if (name === "snapshot_project") return "查看了知识库概览";
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
  if (name === "category_list") return `列出 ${outputCount(output, "categories")} 个 Category`;
  if (name === "category_inspect") {
    return `查看了「${stringValue(outputRecord.name) || stringValue(input.categoryId) || "领域"}」下的内容`;
  }
  if (name === "thought_list") {
    return `列出 ${outputCount(output, "thoughts")} 条 Thought`;
  }
  if (name === "search_thoughts") {
    return `搜索到 ${outputCount(output, "thoughts")} 条 Thought`;
  }
  if (name === "search_contexts") return `搜索到 ${outputCount(output, "contexts")} 条 Context`;
  if (name === "search_all") {
    return `搜索了 ${outputCount(output, "thoughts")} 条 Thought / ${outputCount(output, "contexts")} 条 Context`;
  }
  if (name === "thought_get")
    return `读取了「${entityTitle(outputRecord.thought) || entityTitle(outputRecord) || stringValue(input.thoughtId) || "Thought"}」`;
  if (name === "context_list") return `列出 ${outputCount(output, "contexts")} 条 Context`;
  if (name === "context_get")
    return `读取了「${entityTitle(outputRecord.context) || entityTitle(outputRecord) || stringValue(input.contextId) || "Context"}」`;
  if (name === "graph_neighborhood")
    return `查看了「${entityTitle(outputRecord.seed) || stringValue(input.thoughtId) || "Thought"}」附近的关联`;
  if (name === "graph_path") return "查找了两条想法之间的路径";
  return `使用了 ${name}`;
}

function entityTitle(value: unknown) {
  if (!isRecord(value)) return undefined;
  return stringValue(value.title) || stringValue(value.name) || stringValue(value.sourceName);
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function outputCount(output: unknown, key: string) {
  if (Array.isArray(output)) return output.length;
  return isRecord(output) ? arrayValue(output[key]).length : 0;
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
