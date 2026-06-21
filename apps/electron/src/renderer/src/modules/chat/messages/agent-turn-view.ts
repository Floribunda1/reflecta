import {
  getToolName,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type DynamicToolUIPart,
  type ReasoningUIPart,
  type ToolUIPart,
} from "ai";
import type { AgentChatMessage, AgentProposalType } from "@shared/chat";

export type AgentToolPart = ToolUIPart | DynamicToolUIPart;
export type ProposalType = AgentProposalType;
export type ToolApprovalStatus = "pending" | "approved" | "rejected";
export type ToolGroupType = "lookup" | "graph" | "other";

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
  state: AgentToolPart["state"];
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
  | { kind: "reasoning"; parts: ReasoningUIPart[] }
  | { kind: "tool-group"; groupType: ToolGroupType; parts: AgentToolPart[] }
  | { kind: "proposal"; proposal: ProposalView };

export function buildAgentTurnView(parts: AgentChatMessage["parts"]): AgentTurnView {
  const internalBlocks: InternalTurnBlock[] = [];

  for (const part of parts) {
    if (isTextUIPart(part)) {
      appendText(internalBlocks, part.text);
      continue;
    }
    if (isReasoningUIPart(part)) {
      appendReasoning(internalBlocks, part);
      continue;
    }
    if (!isToolUIPart(part)) continue;

    const proposal = proposalViewFor(part);
    if (proposal) {
      internalBlocks.push({ kind: "proposal", proposal });
      continue;
    }

    appendTool(internalBlocks, toolGroupType(part), part);
  }

  const blocks = internalBlocks.map(toPublicBlock);

  return {
    blocks,
  };
}

function toPublicBlock(block: InternalTurnBlock): AgentTurnBlock {
  if (block.kind === "tool-group") {
    return { kind: "tool-activity", activity: summarizeToolGroup(block.groupType, block.parts) };
  }
  if (block.kind === "reasoning") {
    return {
      kind: "reasoning",
      reasoning: {
        text: block.parts
          .map((part) => part.text)
          .join("\n")
          .trim(),
        status: block.parts.some((part) => part.state === "streaming") ? "streaming" : "done",
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

function appendTool(blocks: InternalTurnBlock[], groupType: ToolGroupType, part: AgentToolPart) {
  const last = blocks.at(-1);
  if (last?.kind === "tool-group" && last.groupType === groupType) {
    last.parts.push(part);
    return;
  }
  blocks.push({ kind: "tool-group", groupType, parts: [part] });
}

function appendReasoning(blocks: InternalTurnBlock[], part: ReasoningUIPart) {
  const last = blocks.at(-1);
  if (last?.kind === "reasoning") {
    last.parts.push(part);
    return;
  }
  blocks.push({ kind: "reasoning", parts: [part] });
}

function proposalViewFor(part: AgentToolPart): ProposalView | null {
  const input = toolInput(part);
  const output = toolOutputRecord(part);
  const type = proposalTypeFor(part);
  if (!type) return null;
  const base = {
    toolCallId: part.toolCallId,
    title: proposalTitle(type),
    status: approvalStatus(part),
    state: part.state,
    errorText:
      "errorText" in part && typeof part.errorText === "string" ? part.errorText : undefined,
    resultRefType: stringValue(output.resultRefType),
    resultRefId: stringValue(output.resultRefId),
    approvalId: "approval" in part && part.approval ? part.approval.id : undefined,
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

function proposalTypeFor(part: AgentToolPart): ProposalType | null {
  const metadata = "toolMetadata" in part && isRecord(part.toolMetadata) ? part.toolMetadata : {};
  const type = metadata.proposalType;
  if (type === "thought_create") return "thought_create";
  if (type === "thought_update") return "thought_update";
  if (type === "thought_delete") return "thought_delete";
  if (type === "category_create") return "category_create";
  if (type === "category_update") return "category_update";
  if (type === "category_delete") return "category_delete";
  if (type === "context_create") return "context_create";
  if (type === "context_update") return "context_update";
  if (type === "context_delete") return "context_delete";
  if (type === "bash") return "bash";
  const name = getToolName(part);
  if (name === "thought_create") return "thought_create";
  if (name === "thought_update") return "thought_update";
  if (name === "thought_delete") return "thought_delete";
  if (name === "category_create") return "category_create";
  if (name === "category_update") return "category_update";
  if (name === "category_delete") return "category_delete";
  if (name === "context_create") return "context_create";
  if (name === "context_update") return "context_update";
  if (name === "context_delete") return "context_delete";
  if (name === "bash") return "bash";
  return null;
}

function approvalStatus(part: AgentToolPart): ToolApprovalStatus | undefined {
  if (part.state === "approval-requested") return "pending";
  if (part.state === "approval-responded") {
    return part.approval.approved ? "approved" : "rejected";
  }
  if (part.state === "output-available") return "approved";
  if (part.state === "output-denied") return "rejected";
  return undefined;
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

function summarizeToolGroup(groupType: ToolGroupType, parts: AgentToolPart[]): ToolActivityView {
  const status = parts.some((part) => part.state === "output-error")
    ? "failed"
    : parts.every((part) => part.state === "output-available")
      ? "done"
      : "running";
  const title = toolActivityTitle(groupType, parts);
  const summary =
    status === "running"
      ? runningSummary(groupType)
      : status === "failed"
        ? failedSummary(title, parts)
        : doneSummary(groupType, parts);

  return {
    groupType,
    title,
    status,
    statusLabel: status === "failed" ? "出错" : status === "running" ? "运行中" : "完成",
    summary,
    items: parts.map(toolItemView),
  };
}

function toolGroupType(part: AgentToolPart | undefined): ToolGroupType {
  if (!part) return "other";
  const name = getToolName(part);
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

function toolOutput(part: AgentToolPart): unknown {
  return part.state === "output-available" ? part.output : undefined;
}

function toolOutputRecord(part: AgentToolPart): Record<string, unknown> {
  const output = toolOutput(part);
  return isRecord(output) ? output : {};
}

function toolInput(part: AgentToolPart): Record<string, unknown> {
  return "input" in part && isRecord(part.input) ? part.input : {};
}

function toolItemView(part: AgentToolPart): ToolActivityItemView {
  const toolName = getToolName(part);
  if (part.state === "output-error") {
    return {
      toolCallId: part.toolCallId,
      toolName,
      label: `${toolDoneVerb(toolName)}失败`,
      status: "failed",
      statusLabel: "出错",
      errorText: toolErrorText(part),
    };
  }
  if (part.state !== "output-available") {
    return {
      toolCallId: part.toolCallId,
      toolName,
      label: toolRunningVerb(toolName),
      status: "running",
      statusLabel: "运行中",
    };
  }
  return {
    toolCallId: part.toolCallId,
    toolName,
    label: toolDoneSummary(toolName, toolInput(part), toolOutput(part)),
    status: "done",
    statusLabel: "完成",
  };
}

function runningSummary(groupType: ToolGroupType) {
  if (groupType === "graph") return "正在查看关联";
  if (groupType === "lookup") return "正在查找相关内容";
  return "正在使用工具";
}

function doneSummary(groupType: ToolGroupType, parts: AgentToolPart[]) {
  if (parts.length === 1 && parts[0]) return toolItemView(parts[0]).label;
  if (groupType === "graph") return "查看了关联";
  if (groupType === "lookup") {
    const counts = aggregateLookupCounts(parts);
    if (counts.thoughts || counts.contexts) {
      return `搜索 ${counts.thoughts} 条 Thought，读取 ${counts.contexts} 条 Context`;
    }
    return "查找了相关内容";
  }
  return "使用了工具";
}

function failedSummary(title: string, parts: AgentToolPart[]) {
  const failedItems = parts.filter((part) => part.state === "output-error").map(toolItemView);
  if (failedItems.length === 1) return failedItems[0]?.label ?? `${title}时遇到问题`;
  return `${title}时遇到 ${failedItems.length} 个问题`;
}

function toolErrorText(part: AgentToolPart) {
  return "errorText" in part && typeof part.errorText === "string" ? part.errorText : undefined;
}

function aggregateLookupCounts(parts: AgentToolPart[]) {
  let thoughts = 0;
  let contexts = 0;
  for (const part of parts) {
    if (part.state !== "output-available") continue;
    const name = getToolName(part);
    const output = toolOutput(part);
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

function toolActivityTitle(groupType: ToolGroupType, parts: AgentToolPart[]) {
  if (parts.length === 1 && parts[0]) return toolTitle(getToolName(parts[0]));
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
