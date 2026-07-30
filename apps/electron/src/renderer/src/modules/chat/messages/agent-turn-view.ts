import type {
  AgentMessageBlockView,
  AgentProposalLifecycle,
  AgentProposalView,
  AgentToolActivityView,
  AgentToolDetailsView,
  ChatAssistantMessageView,
} from "@reflecta/ui/chat";
import type {
  AgentContextCompacted,
  AgentReducedAssistantBlock,
  AgentReducedMessage,
} from "../../../../../preload/typings/agent";

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

export type ToolActivityDetailRow = {
  label?: string;
  title?: string;
  description?: string;
  format?: "text" | "pre" | "markdown" | "code";
  language?: string;
};

export type ToolActivityDetailsView = {
  rows: ToolActivityDetailRow[];
  badges?: string[];
  emptyText?: string;
};

export type ToolActivityItemView = {
  toolCallId: string;
  toolName: string;
  label: string;
  status: ToolActivityView["status"];
  statusLabel: string;
  details: ToolActivityDetailsView;
  errorText?: string;
};

export type AgentViewPresentation = {
  entityLabels: ReadonlyMap<string, string>;
  domainPath: (id: string) => string;
};

export type AgentMessageViewOptions = {
  assistantRunning: boolean;
  stopped: boolean;
  presentation: AgentViewPresentation;
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
  preview?: boolean;
  result?: ToolActivityDetailsView;
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
    domainIds?: string[];
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

export type BashProposalView = ProposalBase<
  "bash",
  {
    kind: "bash";
    command: string;
    cwd?: string;
    timeoutMs?: number;
  }
>;

export type GenericProposalView = ProposalBase<
  Exclude<
    ProposalType,
    "understanding_create" | "understanding_update" | "context_create" | "bash"
  >,
  {
    kind: "generic";
    entries: Array<{ key: string; value: string; format?: "markdown" }>;
  }
>;

export type ProposalRenderData = ProposalView["data"];
export type ProposalView =
  | UnderstandingProposalView
  | UnderstandingUpdateProposalView
  | ContextProposalView
  | BashProposalView
  | GenericProposalView;

export type AgentTurnBlock =
  | {
      kind: "text";
      text: string;
      state?: "streaming" | "done" | "failed";
      error?: string;
    }
  | { kind: "reasoning"; reasoning: AgentReasoningView }
  | { kind: "context-compaction"; compaction: AgentContextCompacted }
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
  | {
      kind: "text";
      text: string;
      state?: "streaming" | "done" | "failed";
      error?: string;
    }
  | { kind: "reasoning"; text: string; status: AgentReasoningView["status"] }
  | { kind: "context-compaction"; compaction: AgentContextCompacted }
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
      appendText(internalBlocks, block.text, block.state, block.error);
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
    if (block.kind === "context-compaction") {
      internalBlocks.push(block);
      continue;
    }
    if (block.kind === "approval") {
      internalBlocks.push({ kind: "proposal", proposal: proposalViewFor(block) });
      continue;
    }
    appendTool(internalBlocks, block);
  }

  return {
    blocks: internalBlocks.map(toPublicBlock),
  };
}

function approvalMap(blocks: readonly AgentReducedAssistantBlock[]) {
  return new Map(
    blocks.flatMap((block) =>
      block.kind === "approval" ? [[block.toolCallId, block] as const] : [],
    ),
  );
}

function toAgentMessageBlocks(
  messageId: string,
  turnBlocks: readonly AgentTurnBlock[],
  rawBlocks: readonly AgentReducedAssistantBlock[],
  presentation: AgentViewPresentation,
): AgentMessageBlockView[] {
  const approvals = approvalMap(rawBlocks);
  const result: AgentMessageBlockView[] = [];
  let textIndex = 0;
  let reasoningIndex = 0;

  for (const block of turnBlocks) {
    if (block.kind === "text") {
      const id = `${messageId}:text:${textIndex}`;
      textIndex += 1;
      if (!block.text && !block.error) continue;
      result.push({
        kind: "text",
        id,
        markdown: block.text,
        status: block.state ?? "done",
        ...(block.error ? { error: block.error } : {}),
      });
      continue;
    }
    if (block.kind === "reasoning") {
      const id = `${messageId}:reasoning:${reasoningIndex}`;
      reasoningIndex += 1;
      result.push({
        kind: "reasoning",
        reasoning: {
          id,
          status: block.reasoning.status,
          markdown: block.reasoning.text,
        },
      });
      continue;
    }
    if (block.kind === "context-compaction") {
      result.push({
        kind: "context-compaction",
        compaction: {
          id: block.compaction.id,
          summary: block.compaction.summary,
          tokensBefore: block.compaction.tokensBefore,
          estimatedTokensAfter: block.compaction.estimatedTokensAfter,
        },
      });
      continue;
    }
    if (block.kind === "tool-activity") {
      const id = block.activity.items[0]?.toolCallId ?? `${messageId}:tool`;
      result.push({
        kind: "tool-activity",
        activity: toAgentToolActivityView(block.activity, id),
      });
      continue;
    }
    const raw = approvals.get(block.proposal.toolCallId);
    if (!raw) continue;
    result.push({
      kind: "proposal",
      proposal: toAgentProposalView(block.proposal, raw, presentation),
    });
  }
  return result;
}

export function toAgentAssistantMessageView(
  message: AgentReducedMessage,
  options: AgentMessageViewOptions,
): ChatAssistantMessageView {
  const rawBlocks = message.blocks ?? [];
  const turn = buildAgentTurnView(rawBlocks, options.assistantRunning);
  const blocks = toAgentMessageBlocks(message.id, turn.blocks, rawBlocks, options.presentation);
  const status: ChatAssistantMessageView["status"] = options.stopped
    ? "stopped"
    : options.assistantRunning
      ? "streaming"
      : "done";
  return { kind: "assistant", id: message.id, status, blocks };
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

function appendText(
  blocks: InternalTurnBlock[],
  text: string,
  state?: "streaming" | "done" | "failed",
  error?: string,
) {
  if (!text && !error) return;
  const last = blocks.at(-1);
  if (!state && !error && last?.kind === "text") {
    last.text += text;
    return;
  }
  blocks.push({
    kind: "text",
    text,
    ...(state ? { state } : {}),
    ...(error ? { error } : {}),
  });
}

function appendTool(blocks: InternalTurnBlock[], block: AgentToolBlock) {
  blocks.push({ kind: "tool-group", groupType: toolGroupType(block.toolName), blocks: [block] });
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
  const result = proposalResultDetails(type, output, block.displayState);
  const base = {
    toolCallId: block.toolCallId,
    title: block.title || proposalTitle(type),
    status: approvalStatus(block),
    state: proposalState(block),
    errorText: block.error,
    resultRefType: stringValue(output.resultRefType),
    resultRefId: stringValue(output.resultRefId),
    approvalId: block.approvalId,
    preview: block.preview,
    ...(result ? { result } : {}),
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
  if (type === "bash") {
    return { ...base, type, data: bashProposalData(input) };
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
  if (block.approvalState === "pending") return "pending";
  if (block.approvalState === "rejected") return "rejected";
  return block.approved ? "approved" : undefined;
}

function proposalState(block: AgentApprovalBlock): ProposalState {
  if (block.preview) return "input-streaming";
  if (block.displayState === "pending_approval") return "approval-requested";
  if (block.displayState === "running") return "approval-responded";
  if (block.displayState === "rejected") return "output-denied";
  if (block.displayState === "completed") return "output-available";
  if (block.displayState === "failed") return "output-error";
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
  const domainIds = optionalStringArray(after.domainIds) ?? optionalStringArray(output.domainIds);
  return {
    kind: "understanding-update",
    understandingId: stringValue(output.understandingId),
    beforeBody: stringValue(before.body),
    afterBody: stringValue(after.body),
    ...(domainIds !== undefined ? { domainIds } : {}),
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

function proposalResultDetails(
  type: ProposalType,
  output: Record<string, unknown>,
  displayState: AgentApprovalBlock["displayState"],
) {
  if (displayState !== "completed") return undefined;
  if (type === "bash") return bashDetails(output);

  const resultRefId = stringValue(output.resultRefId);
  if (!resultRefId) return undefined;
  return detailView({
    rows: [
      detailRow(
        "执行结果",
        `${proposalResultTypeLabel(stringValue(output.resultRefType))} 已完成`,
        resultRefId,
      ),
    ],
  });
}

function proposalResultTypeLabel(type: string) {
  if (type === "understanding") return "Understanding";
  if (type === "domain") return "Domain";
  if (type === "context") return "Context";
  return "操作";
}

function bashProposalData(output: Record<string, unknown>): BashProposalView["data"] {
  const cwd = stringValue(output.cwd).trim();
  const timeoutMs = typeof output.timeoutMs === "number" ? output.timeoutMs : undefined;
  return {
    kind: "bash",
    command: stringValue(output.command),
    ...(cwd ? { cwd } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };
}

function genericProposalData(output: Record<string, unknown>): GenericProposalView["data"] {
  return {
    kind: "generic",
    entries: Object.entries(output)
      .filter(([key, value]) => key !== "proposalType" && value !== undefined)
      .map(([key, value]) => {
        const format = genericProposalEntryFormat(key);
        return { key, value: proposalValue(value), ...(format ? { format } : {}) };
      }),
  };
}

function genericProposalEntryFormat(
  key: string,
): GenericProposalView["data"]["entries"][number]["format"] {
  if (key === "body" || key === "content") return "markdown";
  return undefined;
}

function proposalValue(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.join(", ");
  if (isRecord(value)) return JSON.stringify(value);
  return String(value);
}

function toAgentToolDetailsView(
  details: ToolActivityDetailsView | undefined,
  ownerId: string,
): AgentToolDetailsView | undefined {
  if (!details) return undefined;
  return {
    ...(details.badges?.length ? { badges: details.badges } : {}),
    ...(details.rows.length
      ? {
          rows: details.rows.map((row, index) => {
            const format = row.format ?? "text";
            const content = row.description
              ? format === "text"
                ? { format: "text" as const, value: row.description }
                : format === "code"
                  ? {
                      format: "code" as const,
                      value: row.description,
                      language: row.language ?? "text",
                    }
                  : {
                      format,
                      value: row.description,
                    }
              : undefined;
            return {
              id: `${ownerId}:row:${index}`,
              ...(row.label ? { label: row.label } : {}),
              ...(row.title ? { title: row.title } : {}),
              ...(content ? { content } : {}),
            };
          }),
        }
      : {}),
    ...(details.emptyText ? { emptyText: details.emptyText } : {}),
  };
}

export function toAgentToolActivityView(
  activity: ToolActivityView,
  id = activity.items[0]?.toolCallId ?? "tool",
): AgentToolActivityView {
  return {
    id,
    toolName: activity.items[0]?.toolName,
    status: activity.status,
    summary: activity.summary,
    items: activity.items.map((item) => ({
      id: item.toolCallId,
      label: item.label,
      ...(item.details ? { details: toAgentToolDetailsView(item.details, item.toolCallId) } : {}),
      ...(item.errorText ? { error: item.errorText } : {}),
    })),
  };
}

function lifecycleFor(block: AgentApprovalBlock): AgentProposalLifecycle {
  if (block.preview) return "preview";
  if (block.displayState === "pending_approval") return "pending";
  if (block.displayState === "running") return "running";
  if (block.displayState === "completed") return "completed";
  if (block.displayState === "rejected") return "rejected";
  if (block.displayState === "failed") return "failed";
  return "preview";
}

function proposalNote(proposal: ProposalView, lifecycle: AgentProposalLifecycle) {
  if (lifecycle === "completed" && proposal.resultRefType && proposal.resultRefId) {
    return `已写入 ${proposal.resultRefType} · ${proposal.resultRefId}`;
  }
  if (lifecycle === "rejected") {
    return proposal.type === "bash" ? "已拒绝，命令未执行" : "已拒绝，未写入知识库";
  }
  return undefined;
}

function proposalBase(proposal: ProposalView, raw: AgentApprovalBlock) {
  const lifecycle = lifecycleFor(raw);
  const note = proposalNote(proposal, lifecycle);
  return {
    id: raw.approvalId || raw.toolCallId,
    title: raw.title || proposal.title,
    lifecycle,
    ...(note ? { note } : {}),
    ...(raw.error ? { error: raw.error } : {}),
    ...(proposal.result
      ? { result: toAgentToolDetailsView(proposal.result, raw.approvalId || raw.toolCallId) }
      : {}),
    ...(lifecycle === "pending" ? { decisionEnabled: true } : {}),
  };
}

function proposalEntityLabel(
  type: "understanding" | "context",
  id: string | undefined,
  presentation: AgentViewPresentation,
) {
  if (!id) return undefined;
  return presentation.entityLabels.get(`${type}:${id}`) ?? id;
}

function proposalDomainPath(
  value: unknown,
  presentation: AgentViewPresentation,
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value ? presentation.domainPath(value) : null;
}

export function toAgentProposalView(
  proposal: ProposalView,
  raw: AgentApprovalBlock,
  presentation: AgentViewPresentation,
): AgentProposalView {
  const input = isRecord(raw.payload) ? raw.payload : {};
  const base = proposalBase(proposal, raw);

  if (raw.toolName === "understanding_create") {
    const domainIds = optionalStringArray(input.domainIds);
    return {
      ...base,
      kind: "understanding-create",
      content: {
        heading: optionalString(input.title),
        body: optionalString(input.body),
        ...(domainIds ? { domainPaths: domainIds.map(presentation.domainPath) } : {}),
      },
    };
  }
  if (raw.toolName === "understanding_update") {
    const before = isRecord(input.before) ? input.before : {};
    const after = isRecord(input.after) ? input.after : input;
    const id = optionalString(input.understandingId);
    const domainIds = optionalStringArray(after.domainIds) ?? optionalStringArray(input.domainIds);
    return {
      ...base,
      kind: "understanding-update",
      content: {
        targetLabel: proposalEntityLabel("understanding", id, presentation),
        beforeHeading: optionalString(before.title),
        afterHeading: optionalString(after.title),
        beforeBody: optionalString(before.body),
        afterBody: optionalString(after.body),
        ...(domainIds ? { domainPaths: domainIds.map(presentation.domainPath) } : {}),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "understanding_delete") {
    const id = optionalString(input.understandingId);
    return {
      ...base,
      kind: "understanding-delete",
      content: {
        targetLabel: proposalEntityLabel("understanding", id, presentation),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "domain_create") {
    return {
      ...base,
      kind: "domain-create",
      content: {
        name: optionalString(input.name),
        parentPath: proposalDomainPath(input.parentId, presentation),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "domain_update") {
    const id = optionalString(input.domainId);
    return {
      ...base,
      kind: "domain-update",
      content: {
        targetPath: id ? presentation.domainPath(id) : undefined,
        nextName: optionalString(input.name),
        nextParentPath: proposalDomainPath(input.parentId, presentation),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "domain_delete") {
    const id = optionalString(input.domainId);
    return {
      ...base,
      kind: "domain-delete",
      content: {
        targetPath: id ? presentation.domainPath(id) : undefined,
        deleteUnderstandings:
          typeof input.deleteUnderstandings === "boolean" ? input.deleteUnderstandings : undefined,
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "context_create") {
    const understandingId = optionalString(input.understandingId);
    return {
      ...base,
      kind: "context-create",
      content: {
        understandingLabel: proposalEntityLabel("understanding", understandingId, presentation),
        mediumLabel:
          mediumLabel(optionalString(input.medium) ?? "") || optionalString(input.medium),
        contextLabel: optionalString(input.title),
        body: optionalString(input.content),
      },
    };
  }
  if (raw.toolName === "context_update") {
    const contextId = optionalString(input.contextId);
    const understandingId = optionalString(input.understandingId);
    return {
      ...base,
      kind: "context-update",
      content: {
        targetLabel: proposalEntityLabel("context", contextId, presentation),
        understandingLabel: proposalEntityLabel("understanding", understandingId, presentation),
        mediumLabel:
          mediumLabel(optionalString(input.medium) ?? "") || optionalString(input.medium),
        nextTitle: optionalString(input.title),
        nextBody: optionalString(input.content),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "context_delete") {
    const id = optionalString(input.contextId);
    return {
      ...base,
      kind: "context-delete",
      content: {
        targetLabel: proposalEntityLabel("context", id, presentation),
        reason: optionalString(input.reason),
      },
    };
  }
  if (raw.toolName === "bash") {
    return {
      ...base,
      kind: "bash",
      content: {
        command: optionalString(input.command),
        cwd: optionalString(input.cwd),
        timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : undefined,
      },
    };
  }
  return {
    ...base,
    kind: "unknown",
    content: {
      fields: Object.entries(input)
        .filter(([key, value]) => key !== "proposalType" && value !== undefined)
        .map(([key, value]) => ({
          id: `${raw.approvalId}:${key}`,
          label: key,
          value: {
            format: key === "body" || key === "content" ? ("markdown" as const) : ("text" as const),
            value: proposalValue(value),
          },
        })),
    },
  };
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
      ? blocks.length === 1 && blocks[0]
        ? toolItemView(blocks[0]).label
        : runningSummary(groupType)
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
    name === "graph" ||
    name === "web_search" ||
    name === "fetch_content" ||
    name === "get_search_content" ||
    name.startsWith("understanding_") ||
    name.startsWith("context_") ||
    name.startsWith("domain_") ||
    name === "read" ||
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
      label: toolFailedSummary(toolName, toolInput(block)),
      status: "failed",
      statusLabel: "出错",
      details: toolDetails(block),
      errorText: block.error,
    };
  }
  if (block.state !== "completed") {
    return {
      toolCallId: block.toolCallId,
      toolName,
      label: toolRunningSummary(toolName, toolInput(block)),
      status: "running",
      statusLabel: "运行中",
      details: toolDetails(block),
    };
  }
  return {
    toolCallId: block.toolCallId,
    toolName,
    label: toolDoneSummary(toolName, toolInput(block), toolOutput(block)),
    status: "done",
    statusLabel: "完成",
    details: toolDetails(block),
  };
}

function runningSummary(groupType: ToolGroupType) {
  if (groupType === "lookup") return "正在查找相关内容";
  return "正在使用工具";
}

function doneSummary(groupType: ToolGroupType, blocks: AgentToolBlock[]) {
  if (blocks.length === 1 && blocks[0]) return toolItemView(blocks[0]).label;
  if (groupType === "lookup") {
    return joinedToolLabels(blocks);
  }
  return joinedToolLabels(blocks);
}

function failedSummary(title: string, blocks: AgentToolBlock[]) {
  const failedItems = blocks.filter((block) => block.state === "failed").map(toolItemView);
  if (failedItems.length === 1) return failedItems[0]?.label ?? `${title}时遇到问题`;
  return `${title}时遇到 ${failedItems.length} 个问题`;
}

function joinedToolLabels(blocks: AgentToolBlock[]) {
  const labels = blocks.map((block) => toolItemView(block).label);
  const visible = labels.slice(0, 2).join("；");
  return labels.length > 2 ? `${visible} 等 ${labels.length} 步` : visible || "使用了工具";
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
  if (name === "web_search") return "搜索网页";
  if (name === "fetch_content") return "读取来源";
  if (name === "get_search_content") return "读取搜索内容";
  if (name === "retrieve_knowledge") return "检索知识";
  if (name === "search") return "搜索相关内容";
  if (name === "graph") return "查看关联图";
  if (name === "attachment_read") return "读取附件";
  if (name === "read") return "读取本地文件";
  if (name === "file_read") return "读取本地文件";
  if (name === "edit") return "编辑本地文件";
  if (name === "write") return "写入本地文件";
  if (name === "bash") return "执行 Bash";
  return "使用工具";
}

function queryLabel(input: Record<string, unknown>) {
  const query = stringValue(input.query).trim();
  if (query) return `「${query}」`;
  const queries = arrayValue(input.queries)
    .map(stringValue)
    .map((item) => item.trim())
    .filter(Boolean);
  if (queries.length === 1) return `「${queries[0]}」`;
  return queries.length > 1 ? `「${queries[0]}」等 ${queries.length} 个查询` : "";
}

function quotedValue(value: unknown) {
  const text = stringValue(value).trim();
  return text ? `「${truncateText(text, 72)}」` : "";
}

function webSourceUrls(input: Record<string, unknown>) {
  const urls = stringArray(input.urls);
  const url = stringValue(input.url).trim();
  return urls.length > 0 ? urls : url ? [url] : [];
}

function webSourceCount(input: Record<string, unknown>) {
  return webSourceUrls(input).length;
}

function webSourceLabel(input: Record<string, unknown>) {
  const urls = webSourceUrls(input);
  if (urls.length > 1) return `（${urls.length} 个来源）`;
  const url = urls[0];
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return `「${truncateText(`${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`, 60)}」`;
  } catch {
    return `「${truncateText(url, 60)}」`;
  }
}

function searchContentTarget(input: Record<string, unknown>) {
  const query = stringValue(input.query).trim();
  if (query) return `搜索「${truncateText(query, 60)}」的完整内容`;
  const url = stringValue(input.url).trim();
  if (url) return `网页${webSourceLabel({ url })}`;
  if (typeof input.queryIndex === "number") return `第 ${input.queryIndex + 1} 组搜索结果`;
  if (typeof input.urlIndex === "number") return `第 ${input.urlIndex + 1} 个网页来源`;
  return "";
}

function readParameterLabel(input: Record<string, unknown>) {
  return (["offset", "limit"] as const)
    .flatMap((name) => {
      const value = input[name];
      return typeof value === "number" && Number.isFinite(value) ? [`${name}=${value}`] : [];
    })
    .join(" · ");
}

function toolDetails(block: AgentToolBlock): ToolActivityDetailsView {
  const input = toolInput(block);
  const output = toolOutput(block);
  if (block.state !== "completed") return detailView({});

  return toolResultDetails(block.toolName, output, input);
}

function toolResultDetails(
  name: string,
  output: unknown,
  input: Record<string, unknown>,
): ToolActivityDetailsView {
  if (name === "search") return searchHitDetails(output);
  if (name === "retrieve_knowledge") return retrievalCandidateDetails(output);
  if (name === "attachment_read") return attachmentReadDetails(output);
  if (name === "read" || name === "file_read") return readFileDetails(output, input);
  if (name === "edit") return editFileDetails(output);
  if (name === "write") return writeFileDetails(input);
  if (name === "bash") return bashDetails(output);
  if (name === "web_search" || name === "fetch_content" || name === "get_search_content") {
    return webAccessDetails(output);
  }
  if (name === "domain_list") return domainListDetails(output);
  if (name === "understanding_list")
    return recordListDetails(output, "Understanding", "understandings");
  if (name === "context_list") return recordListDetails(output, "Context", "contexts");
  if (name === "domain_inspect") return inspectDomainDetails(output);
  if (name === "understanding_get")
    return recordDetailView(entityRecord(output, "understanding"), "Understanding");
  if (name === "context_get") return recordDetailView(entityRecord(output, "context"), "Context");
  if (name === "graph") return graphDetails(output);
  return detailView({});
}

function attachmentReadDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const filename = stringValue(output.filename);
  const content = stringValue(output.content);
  const error = stringValue(output.error);
  const isText = output.kind === "text";
  return detailView({
    rows: content
      ? [
          detailRow(
            "",
            "",
            content,
            isText ? "code" : "pre",
            isText ? codeLanguage(filename) : undefined,
          ),
        ]
      : [],
    emptyText: error ? `附件暂时无法读取：${truncateText(error)}` : undefined,
  });
}

function readFileDetails(output: unknown, input: Record<string, unknown>) {
  if (!isRecord(output)) return detailView({});
  const content = stringValue(output.content);
  return detailView({
    rows: content
      ? [detailRow("", "", content, "code", codeLanguage(stringValue(input.path)))]
      : [],
  });
}

function editFileDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const patch = stringValue(output.patch) || stringValue(output.diff);
  return detailView({
    rows: patch ? [detailRow("", "", patch, "code", "diff")] : [],
  });
}

function writeFileDetails(input: Record<string, unknown>) {
  const content = stringValue(input.content);
  return detailView({
    rows: content
      ? [detailRow("", "", content, "code", codeLanguage(stringValue(input.path)))]
      : [],
  });
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function webAccessDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const error = stringValue(output.error).trim();
  const nestedSummary = isRecord(output.summary) ? stringValue(output.summary.text).trim() : "";
  const summary = stringValue(output.summary).trim() || nestedSummary;
  return detailView({
    rows: summary ? [detailRow("", "", summary, "markdown")] : [],
    emptyText: error || undefined,
  });
}

function bashDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const stdout = stringValue(output.stdout);
  const stderr = stringValue(output.stderr);
  return detailView({
    rows: [
      stdout ? detailRow("", "", stdout, "code", "text") : undefined,
      stderr ? detailRow("", "", stderr, "code", "text") : undefined,
    ].filter((row): row is ToolActivityDetailRow => Boolean(row)),
  });
}

function domainListDetails(output: unknown) {
  const domains = Array.isArray(output)
    ? output
    : isRecord(output)
      ? arrayValue(output.domains)
      : [];
  return detailView({
    badges: domains.flatMap((domain) => {
      const title = isRecord(domain) ? entityTitle(domain) : undefined;
      return title ? [title] : [];
    }),
    emptyText: domains.length === 0 ? "没有找到 Domain。" : undefined,
  });
}

function searchHitDetails(output: unknown) {
  const hits = isRecord(output) ? arrayValue(output.hits) : [];
  return detailView({
    rows: limitedRows(
      hits.map((hit) => {
        if (!isRecord(hit)) return undefined;
        if (hit.type === "understanding") {
          const understanding = isRecord(hit.understanding) ? hit.understanding : {};
          return detailRow(
            "Understanding",
            entityTitle(understanding),
            stringValue(hit.matchedText) || stringValue(understanding.body),
            "markdown",
          );
        }
        if (hit.type === "context") {
          const context = isRecord(hit.context) ? hit.context : {};
          return detailRow(
            "Context",
            contextTitle(context),
            stringValue(hit.matchedText),
            "markdown",
          );
        }
        return undefined;
      }),
    ),
    emptyText: hits.length === 0 ? "没有搜索到相关内容。" : undefined,
  });
}

function retrievalCandidateDetails(output: unknown) {
  const candidates = isRecord(output) ? arrayValue(output.candidates) : [];
  const rows = candidates.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    return [
      detailRow(
        "Understanding",
        entityTitle(candidate),
        stringValue(candidate.snippet),
        "markdown",
      ),
      ...arrayValue(candidate.matchedContexts)
        .slice(0, 2)
        .map((context) =>
          isRecord(context)
            ? detailRow(
                "Context 证据",
                contextTitle(context),
                stringValue(context.snippet),
                "markdown",
              )
            : undefined,
        ),
    ];
  });
  return detailView({
    rows: limitedRows(rows),
    emptyText: candidates.length === 0 ? "没有找到直接相关的理解。" : undefined,
  });
}

function recordListDetails(output: unknown, label: string, emptyLabel: string) {
  const records = Array.isArray(output)
    ? output
    : isRecord(output)
      ? arrayValue(output[emptyLabel])
      : [];
  const contextsByUnderstandingId =
    isRecord(output) && isRecord(output.contextsByUnderstandingId)
      ? output.contextsByUnderstandingId
      : {};
  return detailView({
    rows: limitedRows(
      records.flatMap((record) => {
        if (!isRecord(record)) return [];
        return [
          detailRow(
            label,
            label === "Context" ? contextTitle(record) : entityTitle(record),
            recordText(record),
            "markdown",
          ),
          ...arrayValue(contextsByUnderstandingId[stringValue(record.id)]).map((context) =>
            isRecord(context)
              ? detailRow("Context", contextTitle(context), recordText(context), "markdown")
              : undefined,
          ),
        ];
      }),
    ),
    emptyText: records.length === 0 ? "没有找到相关内容。" : undefined,
  });
}

function inspectDomainDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const domain = entityRecord(output, "domain");
  const understandings = arrayValue(output.understandings);
  const contexts = arrayValue(output.contexts);
  const domains = arrayValue(output.domains);
  return detailView({
    rows: limitedRows([
      detailRow("Domain", entityTitle(domain)),
      ...domains.map((record) =>
        isRecord(record) ? detailRow("子 Domain", entityTitle(record)) : undefined,
      ),
      ...understandings.map((record) =>
        isRecord(record)
          ? detailRow("Understanding", entityTitle(record), recordText(record), "markdown")
          : undefined,
      ),
      ...contexts.map((record) =>
        isRecord(record)
          ? detailRow("Context", contextTitle(record), recordText(record), "markdown")
          : undefined,
      ),
    ]),
  });
}

function recordDetailView(record: Record<string, unknown>, label: string) {
  return detailView({
    rows: [
      detailRow(
        label,
        label === "Context" ? contextTitle(record) : entityTitle(record),
        recordText(record),
        "markdown",
      ),
      ...arrayValue(record.contexts)
        .slice(0, 3)
        .map((context) =>
          isRecord(context)
            ? detailRow("Context", contextTitle(context), recordText(context), "markdown")
            : undefined,
        ),
      ...arrayValue(record.relations)
        .slice(0, 3)
        .map((relation) =>
          isRecord(relation)
            ? detailRow("关联", relationTitle(relation), stringValue(relation.rawText))
            : undefined,
        ),
    ].filter((row): row is ToolActivityDetailRow => Boolean(row)),
  });
}

function graphDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const nodes = arrayValue(output.nodes);
  return detailView({
    rows: limitedRows(
      nodes.map((node) =>
        isRecord(node)
          ? detailRow("Understanding", entityTitle(node), recordText(node), "markdown")
          : undefined,
      ),
    ),
    emptyText: nodes.length === 0 ? "这条 Understanding 暂时没有显式关联。" : undefined,
  });
}

function entityRecord(output: unknown, key: string) {
  if (!isRecord(output)) return {};
  const nested = output[key];
  return isRecord(nested) ? nested : output;
}

function detailView({
  rows = [],
  badges = [],
  emptyText,
}: {
  rows?: Array<ToolActivityDetailRow | undefined>;
  badges?: string[];
  emptyText?: string;
}): ToolActivityDetailsView {
  const view = {
    rows: rows.filter((row): row is ToolActivityDetailRow => Boolean(row)),
    ...(badges.length ? { badges: badges.filter(Boolean) } : {}),
  };
  return emptyText ? { ...view, emptyText } : view;
}

function detailRow(
  label: string,
  title?: string,
  description?: string,
  format: ToolActivityDetailRow["format"] = "text",
  language?: string,
): ToolActivityDetailRow {
  const keepsLineBreaks = format === "pre" || format === "markdown" || format === "code";
  const compactDescription = description
    ? keepsLineBreaks
      ? description.trim()
      : truncateText(description, 140)
    : undefined;
  return {
    ...(label ? { label } : {}),
    ...(title ? { title } : {}),
    ...(format !== "text" ? { format } : {}),
    ...(language ? { language } : {}),
    ...(compactDescription ? { description: compactDescription } : {}),
  };
}

function codeLanguage(path: string) {
  const extension = filenameFromPath(path).split(".").pop()?.toLowerCase();
  if (!extension || extension === filenameFromPath(path)) return "text";
  if (extension === "md" || extension === "mdx") return "markdown";
  if (extension === "yml") return "yaml";
  if (extension === "txt" || extension === "log") return "text";
  return extension;
}

function limitedRows(rows: Array<ToolActivityDetailRow | undefined>) {
  const filtered = rows.filter((row): row is ToolActivityDetailRow => Boolean(row));
  const visible = filtered.slice(0, 8);
  return filtered.length > visible.length
    ? [...visible, detailRow("更多", `还有 ${filtered.length - visible.length} 条结果`)]
    : visible;
}

function truncateText(text: string, maxLength = 80) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function toolRunningSummary(name: string, input: Record<string, unknown>) {
  if (name === "web_search") return `正在搜索网页${queryLabel(input)}`;
  if (name === "search") return `正在搜索${queryLabel(input) || "相关内容"}`;
  if (name === "retrieve_knowledge") return `正在检索${queryLabel(input) || "知识"}`;
  if (name === "read" || name === "file_read") {
    const parameters = readParameterLabel(input);
    return `正在读取「${filenameFromPath(stringValue(input.path)) || "本地文件"}」${parameters ? ` · ${parameters}` : ""}`;
  }
  if (name === "edit")
    return `正在编辑「${filenameFromPath(stringValue(input.path)) || "本地文件"}」`;
  if (name === "write")
    return `正在写入「${filenameFromPath(stringValue(input.path)) || "本地文件"}」`;
  if (name === "bash") return `正在执行 Bash${quotedValue(input.command)}`;
  if (name === "fetch_content") return `正在读取网页${webSourceLabel(input)}`;
  if (name === "get_search_content")
    return `正在读取${searchContentTarget(input) || "已保存的搜索内容"}`;
  if (name === "domain_list") return "正在列出 Domain";
  if (name === "domain_inspect") return `正在查看 Domain${quotedValue(input.domainId)}`;
  if (name === "understanding_list") return "正在列出 Understanding";
  if (name === "understanding_get")
    return `正在读取 Understanding${quotedValue(input.understandingId)}`;
  if (name === "context_list")
    return `正在列出 Understanding${quotedValue(input.understandingId)}的 Context`;
  if (name === "context_get") return `正在读取 Context${quotedValue(input.contextId)}`;
  if (name === "graph")
    return `正在查看 Understanding${quotedValue(input.understandingId)}的关联图`;
  if (name === "attachment_read") return "正在读取附件";
  return `正在使用「${name}」`;
}

function toolFailedSummary(name: string, input: Record<string, unknown>) {
  const [action, ...meta] = toolRunningSummary(name, input)
    .replace(/^正在/, "")
    .split(" · ");
  return `${action}失败${meta.length > 0 ? ` · ${meta.join(" · ")}` : ""}`;
}

function toolDoneSummary(name: string, input: Record<string, unknown>, output: unknown) {
  const outputRecord = isRecord(output) ? output : {};
  if (name === "read" || name === "file_read") {
    const path = stringValue(input.path);
    const parameters = readParameterLabel(input);
    return `读取了「${filenameFromPath(path) || "本地文件"}」${parameters ? ` · ${parameters}` : ""}`;
  }
  if (name === "edit") {
    return `编辑了「${filenameFromPath(stringValue(input.path)) || "本地文件"}」`;
  }
  if (name === "write") {
    return `写入了「${filenameFromPath(stringValue(input.path)) || "本地文件"}」`;
  }
  if (name === "attachment_read") {
    const target = stringValue(outputRecord.filename) || stringValue(input.attachmentId);
    return `读取了附件${target ? `「${target}」` : ""}`;
  }
  if (name === "web_search") {
    const results = numberValue(outputRecord.totalResults);
    return `搜索网页${queryLabel(input)}${results === undefined ? "" : ` · ${results} 个来源`}`;
  }
  if (name === "fetch_content") {
    const title = stringValue(outputRecord.title).trim();
    const urlCount = numberValue(outputRecord.urlCount) ?? webSourceCount(input);
    const successful = numberValue(outputRecord.successful);
    if (title) return `读取网页「${truncateText(title, 60)}」`;
    if (urlCount > 1) {
      return `读取 ${urlCount} 个网页来源${successful === undefined ? "" : ` · ${successful} 个成功`}`;
    }
    return `读取网页${webSourceLabel(input)}`;
  }
  if (name === "get_search_content") {
    const title = stringValue(outputRecord.title).trim();
    const target = title ? `网页「${truncateText(title, 60)}」` : searchContentTarget(input);
    const count = numberValue(outputRecord.resultCount);
    return `读取${target || "已保存的搜索内容"}${count === undefined ? "" : ` · ${count} 个来源`}`;
  }
  if (name === "bash") {
    const command = stringValue(input.command).trim();
    const exitCode = numberValue(outputRecord.exitCode);
    return `执行 Bash${command ? `「${truncateText(command, 72)}」` : ""}${exitCode === undefined ? "" : ` · 退出码 ${exitCode}`}`;
  }
  if (name === "domain_list") return `列出 Domain · ${outputCount(output, "domains")} 个`;
  if (name === "domain_inspect") {
    const target =
      entityTitle(outputRecord.domain) ||
      entityTitle(outputRecord) ||
      stringValue(input.domainId) ||
      "Domain";
    const understandings = outputCount(output, "understandings");
    const contexts = outputCount(output, "contexts");
    return `查看 Domain「${target}」 · ${understandings} 条 Understanding / ${contexts} 条 Context`;
  }
  if (name === "understanding_list") {
    const domainCount = stringArray(input.domainIds).length;
    return `列出${domainCount > 0 ? ` ${domainCount} 个 Domain 中的` : ""} Understanding · ${outputCount(output, "understandings")} 条`;
  }
  if (name === "search") {
    const counts = searchHitCounts(output);
    const query = queryLabel(input);
    return query
      ? `搜索${query} · ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context`
      : `搜索了 ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context`;
  }
  if (name === "retrieve_knowledge") {
    const counts = retrievalCandidateCounts(output);
    const query = queryLabel(input);
    return query
      ? `检索${query} · ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context 证据`
      : `检索到 ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context 证据`;
  }
  if (name === "graph") {
    const nodes = arrayValue(outputRecord.nodes);
    const seedId = stringValue(input.understandingId);
    const seed = nodes.find((node) => isRecord(node) && stringValue(node.id) === seedId);
    const target =
      (isRecord(seed) ? entityTitle(seed) : undefined) ||
      (isRecord(nodes[0]) ? entityTitle(nodes[0]) : undefined) ||
      seedId;
    return `查看 Understanding${target ? `「${target}」` : " "}的关联图 · ${nodes.length} 个节点 / ${arrayValue(outputRecord.edges).length} 条关联`;
  }
  if (name === "understanding_get")
    return `读取了「${entityTitle(outputRecord.understanding) || entityTitle(outputRecord) || stringValue(input.understandingId) || "Understanding"}」`;
  if (name === "context_list")
    return `列出 Understanding「${stringValue(input.understandingId) || "未知"}」的 Context · ${outputCount(output, "contexts")} 条`;
  if (name === "context_get")
    return `读取了「${entityTitle(outputRecord.context) || entityTitle(outputRecord) || stringValue(input.contextId) || "Context"}」`;
  return `使用工具「${name}」`;
}

function entityTitle(value: unknown) {
  if (!isRecord(value)) return undefined;
  return stringValue(value.title) || stringValue(value.name);
}

function contextTitle(value: Record<string, unknown>) {
  return entityTitle(value) || mediumLabel(stringValue(value.medium)) || "Context";
}

function recordText(value: Record<string, unknown>) {
  return stringValue(value.body) || stringValue(value.content) || stringValue(value.snippet);
}

function relationTitle(value: Record<string, unknown>) {
  const direction = stringValue(value.direction);
  if (direction === "incoming") return stringValue(value.sourceTitle) || "被引用的 Understanding";
  return stringValue(value.targetTitle) || "引用的 Understanding";
}

function mediumLabel(value: string) {
  if (value === "experience") return "实践";
  if (value === "video") return "视频";
  if (value === "book") return "书籍";
  if (value === "article") return "文章";
  if (value === "opinion") return "观点";
  if (value === "ai") return "AI 对话";
  if (value === "other") return "其他";
  return "";
}

function filenameFromPath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.split(/[\\/]/).filter(Boolean).at(-1) ?? trimmed;
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

function retrievalCandidateCounts(output: unknown) {
  const candidates = isRecord(output) ? arrayValue(output.candidates) : [];
  let contexts = 0;
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    contexts += arrayValue(candidate.matchedContexts).length;
  }
  return { understandings: candidates.length, contexts };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
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
