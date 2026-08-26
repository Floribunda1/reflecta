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
import type { CanvasDocument } from "@reflecta/ui/canvas";
import type { CanvasUnderstandingRefView } from "@reflecta/ui/canvas";
import type { PiApprovalToolName, PiToolName } from "@reflecta/shared";
import { isPiToolName, PI_TOOL_LABELS } from "@reflecta/shared";

export type ProposalType = PiApprovalToolName | "bash";
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
  createdAt?: string;
};

export type ToolActivityDetailRow = {
  label?: string;
  title?: string;
  description?: string;
  format?: "text" | "pre" | "markdown" | "code";
  language?: string;
  appearance?: "list-item" | "nested-list-item";
  previewLines?: number;
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
  understandingRefs?: ReadonlyMap<string, CanvasUnderstandingRefView>;
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

export type CanvasProposalView = ProposalBase<
  "canvas_create" | "canvas_update" | "canvas_delete",
  {
    kind: "canvas";
    variant: "create" | "update" | "delete";
    /** 候选画布草稿文档（create 的 initial / update 的 document） */
    document?: { elements: unknown[]; edges: unknown[] };
    targetLabel?: string;
    reason?: string;
  }
>;

export type GenericProposalView = ProposalBase<
  Exclude<
    ProposalType,
    | "understanding_create"
    | "understanding_update"
    | "context_create"
    | "bash"
    | "canvas_create"
    | "canvas_update"
    | "canvas_delete"
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
  | CanvasProposalView
  | GenericProposalView;

export type CanvasViewTurnBlock = {
  kind: "canvas-view";
  id: string;
  title: string;
  caption?: string;
  document: { elements: unknown[]; edges: unknown[] };
  /** 供消息层按当前实体状态（hydration B）解析引用卡展示数据 */
  understandingIds: string[];
};

export type AgentTurnBlock =
  | {
      kind: "text";
      text: string;
      state?: "streaming" | "done" | "failed";
      error?: string;
      createdAt?: string;
    }
  | { kind: "reasoning"; reasoning: AgentReasoningView }
  | { kind: "context-compaction"; compaction: AgentContextCompacted }
  | { kind: "tool-activity"; activity: ToolActivityView }
  | { kind: "image"; id: string; src: string; alt: string }
  | CanvasViewTurnBlock
  | { kind: "proposal"; proposal: ProposalView };

export type AgentReasoningView = {
  text: string;
  status: "streaming" | "done";
  createdAt?: string;
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
      createdAt?: string;
    }
  | { kind: "reasoning"; text: string; status: AgentReasoningView["status"]; createdAt?: string }
  | { kind: "context-compaction"; compaction: AgentContextCompacted }
  | { kind: "tool-group"; groupType: ToolGroupType; blocks: AgentToolBlock[] }
  | { kind: "image"; id: string; src: string; alt: string }
  | CanvasViewTurnBlock
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
      appendText(internalBlocks, block.text, block.state, block.error, block.createdAt);
      continue;
    }
    if (block.kind === "reasoning") {
      appendReasoning(
        internalBlocks,
        block.text,
        index === streamingReasoningIndex ? "streaming" : "done",
        block.createdAt,
      );
      continue;
    }
    if (block.kind === "context-compaction") {
      internalBlocks.push(block);
      continue;
    }
    if (block.kind === "approval") {
      internalBlocks.push({
        kind: "proposal",
        proposal: proposalViewFor(block),
      });
      continue;
    }
    appendTool(internalBlocks, block);
    const image = generatedImageBlock(block);
    if (image) internalBlocks.push(image);
    const canvasView = canvasPresentBlock(block);
    if (canvasView) internalBlocks.push(canvasView);
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
        ...(block.createdAt ? { createdAt: block.createdAt } : {}),
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
          ...(block.reasoning.createdAt ? { createdAt: block.reasoning.createdAt } : {}),
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
    if (block.kind === "image") {
      result.push(block);
      continue;
    }
    if (block.kind === "canvas-view") {
      result.push(toAgentCanvasViewBlock(block, presentation));
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

function toAgentCanvasViewBlock(
  block: CanvasViewTurnBlock,
  presentation: AgentViewPresentation,
): AgentMessageBlockView {
  const understandingTitles = block.understandingIds.length
    ? block.understandingIds.map((id) => ({
        id,
        title: presentation.entityLabels.get(`understanding:${id}`) ?? id,
      }))
    : undefined;
  const understandingRefs = new Map(
    block.understandingIds.flatMap((id) => {
      const ref = presentation.understandingRefs?.get(id);
      return ref ? [[id, ref] as const] : [];
    }),
  );
  return {
    kind: "canvas-view",
    id: block.id,
    title: block.title,
    ...(block.caption ? { caption: block.caption } : {}),
    document: block.document as CanvasDocument,
    ...(understandingTitles?.length ? { understandingTitles } : {}),
    ...(understandingRefs.size ? { understandingRefs } : {}),
  };
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
    return {
      kind: "tool-activity",
      activity: summarizeToolGroup(block.groupType, block.blocks),
    };
  }
  if (block.kind === "reasoning") {
    return {
      kind: "reasoning",
      reasoning: {
        text: block.text.trim(),
        status: block.status,
        ...(block.createdAt ? { createdAt: block.createdAt } : {}),
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
  createdAt?: string,
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
    ...(createdAt ? { createdAt } : {}),
  });
}

function appendTool(blocks: InternalTurnBlock[], block: AgentToolBlock) {
  blocks.push({
    kind: "tool-group",
    groupType: toolGroupType(block.toolName),
    blocks: [block],
  });
}

function generatedImageBlock(block: AgentToolBlock): InternalTurnBlock | undefined {
  if (block.toolName !== "image_generate" || block.state !== "completed") return undefined;
  const output = isRecord(block.output) ? block.output : {};
  const assetUrl = stringValue(output.assetUrl);
  const mediaType = stringValue(output.mediaType);
  if (
    output.kind !== "generated-image" ||
    !/^asset:\/\/\/[^/\\]+$/.test(assetUrl) ||
    !mediaType.startsWith("image/")
  ) {
    return undefined;
  }
  const prompt = stringValue(toolInput(block).prompt).replace(/\s+/g, " ").trim();
  return {
    kind: "image",
    id: `${block.toolCallId}:image`,
    src: assetUrl,
    alt: prompt ? `AI 生成图片：${truncateText(prompt, 160)}` : "AI 生成图片",
  };
}

function canvasPresentBlock(block: AgentToolBlock): CanvasViewTurnBlock | undefined {
  if (block.toolName !== "canvas_present" || block.state !== "completed") return undefined;
  const output = isRecord(block.output) ? block.output : {};
  if (output.kind !== "canvas-view" || output.version !== 1) return undefined;
  const rawDoc = isRecord(output.document) ? output.document : undefined;
  const elements = Array.isArray(rawDoc?.elements) ? rawDoc.elements : undefined;
  const edges = Array.isArray(rawDoc?.edges) ? rawDoc.edges : undefined;
  if (!elements || !edges) return undefined;
  const document = { elements, edges };
  const understandingIds: string[] = [];
  for (const element of document.elements) {
    if (
      isRecord(element) &&
      element.kind === "understanding" &&
      typeof element.understandingId === "string" &&
      element.understandingId &&
      !understandingIds.includes(element.understandingId)
    ) {
      understandingIds.push(element.understandingId);
    }
  }
  return {
    kind: "canvas-view",
    id: `${block.toolCallId}:canvas-view`,
    title: stringValue(output.title),
    ...(typeof output.caption === "string" && output.caption ? { caption: output.caption } : {}),
    document,
    understandingIds,
  };
}

function appendReasoning(
  blocks: InternalTurnBlock[],
  text: string,
  status: AgentReasoningView["status"],
  createdAt?: string,
) {
  if (!text) return;
  const last = blocks.at(-1);
  if (last?.kind === "reasoning") {
    last.text += `\n${text}`;
    last.status = last.status === "streaming" || status === "streaming" ? "streaming" : "done";
    return;
  }
  blocks.push({ kind: "reasoning", text, status, ...(createdAt ? { createdAt } : {}) });
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
  if (type === "canvas_create" || type === "canvas_update" || type === "canvas_delete") {
    const document = canvasDocument(input);
    const canvasId = optionalString(input.canvasId);
    return {
      ...base,
      type,
      data: {
        kind: "canvas",
        variant:
          type === "canvas_create" ? "create" : type === "canvas_update" ? "update" : "delete",
        ...(document ? { document } : {}),
        ...(canvasId ? { targetLabel: canvasId } : {}),
        reason: optionalString(input.reason),
      },
    };
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
  if (toolName === "canvas_create") return "canvas_create";
  if (toolName === "canvas_update") return "canvas_update";
  if (toolName === "canvas_delete") return "canvas_delete";
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
  return type === "bash" ? "执行 Bash" : PI_TOOL_LABELS[type];
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
  return type === "bash" ? bashDetails(output) : undefined;
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

/** 从 create 的 initial / update 的 document 提取候选画布草稿文档（payload 已在服务端校验为 CanvasDocument 形态）。 */
function canvasDocument(input: Record<string, unknown>): CanvasDocument | undefined {
  const source = isRecord(input.document)
    ? input.document
    : isRecord(input.initial)
      ? input.initial
      : undefined;
  if (!source || !Array.isArray(source.elements) || !Array.isArray(source.edges)) return undefined;
  return source as unknown as CanvasDocument;
}

export function canvasUnderstandingIds(blocks: readonly AgentReducedAssistantBlock[]) {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.kind === "tool" && block.toolName === "canvas_present") {
      for (const id of canvasPresentBlock(block)?.understandingIds ?? []) ids.add(id);
      continue;
    }
    if (
      block.kind !== "approval" ||
      !["canvas_create", "canvas_update"].includes(block.toolName) ||
      !isRecord(block.payload)
    )
      continue;
    for (const element of canvasDocument(block.payload)?.elements ?? []) {
      if (element.kind === "understanding" && element.understandingId) {
        ids.add(element.understandingId);
      }
    }
  }
  return [...ids];
}

function genericProposalData(output: Record<string, unknown>): GenericProposalView["data"] {
  return {
    kind: "generic",
    entries: Object.entries(output).flatMap(([key, value]) => {
      if (key === "proposalType" || value === undefined) return [];
      const format = genericProposalEntryFormat(key);
      return [
        {
          key,
          value: proposalValue(value),
          ...(format ? { format } : {}),
        },
      ];
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
              ...(row.appearance ? { appearance: row.appearance } : {}),
              ...(row.previewLines ? { previewLines: row.previewLines } : {}),
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
    ...(activity.createdAt ? { createdAt: activity.createdAt } : {}),
    items: activity.items.map((item) => ({
      id: item.toolCallId,
      label: item.label,
      ...(item.details ? { details: toAgentToolDetailsView(item.details, item.toolCallId) } : {}),
      ...(item.errorText ? { error: item.errorText } : {}),
    })),
    ...(activity.createdAt ? { createdAt: activity.createdAt } : {}),
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

function proposalBase(proposal: ProposalView, raw: AgentApprovalBlock) {
  const lifecycle = lifecycleFor(raw);
  return {
    id: raw.approvalId || raw.toolCallId,
    title: raw.title || proposal.title,
    lifecycle,
    ...(raw.rejectionReason ? { rejectionReason: raw.rejectionReason } : {}),
    ...(raw.error ? { error: raw.error } : {}),
    ...(proposal.result
      ? {
          result: toAgentToolDetailsView(proposal.result, raw.approvalId || raw.toolCallId),
        }
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
    const beforeDomainIds = optionalStringArray(before.domainIds);
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
        ...(beforeDomainIds
          ? { beforeDomainPaths: beforeDomainIds.map(presentation.domainPath) }
          : {}),
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
    const before = isRecord(input.before) ? input.before : {};
    const id = optionalString(input.domainId);
    return {
      ...base,
      kind: "domain-update",
      content: {
        targetPath: id ? presentation.domainPath(id) : undefined,
        beforeName: optionalString(before.name),
        beforeParentPath: proposalDomainPath(before.parentId, presentation),
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
    const before = isRecord(input.before) ? input.before : {};
    const contextId = optionalString(input.contextId);
    const beforeUnderstandingId = optionalString(before.understandingId);
    const understandingId = optionalString(input.understandingId);
    return {
      ...base,
      kind: "context-update",
      content: {
        targetLabel: proposalEntityLabel("context", contextId, presentation),
        beforeUnderstandingLabel: proposalEntityLabel(
          "understanding",
          beforeUnderstandingId,
          presentation,
        ),
        beforeMediumLabel:
          mediumLabel(optionalString(before.medium) ?? "") || optionalString(before.medium),
        beforeTitle: optionalString(before.title),
        beforeBody: optionalString(before.content),
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
  if (
    raw.toolName === "canvas_create" ||
    raw.toolName === "canvas_update" ||
    raw.toolName === "canvas_delete"
  ) {
    const doc = canvasDocument(input);
    const understandingIds: string[] = [];
    for (const element of doc?.elements ?? []) {
      if (
        isRecord(element) &&
        element.kind === "understanding" &&
        typeof element.understandingId === "string" &&
        !understandingIds.includes(element.understandingId)
      ) {
        understandingIds.push(element.understandingId);
      }
    }
    const understandingTitles = understandingIds.length
      ? understandingIds.map((id) => ({
          id,
          title: presentation.entityLabels.get(`understanding:${id}`) ?? id,
        }))
      : undefined;
    const understandingRefs = new Map(
      understandingIds.flatMap((id) => {
        const ref = presentation.understandingRefs?.get(id);
        return ref ? [[id, ref] as const] : [];
      }),
    );
    return {
      ...base,
      kind: "canvas",
      content: {
        variant:
          raw.toolName === "canvas_create"
            ? "create"
            : raw.toolName === "canvas_update"
              ? "update"
              : "delete",
        ...(optionalString(input.canvasId) ? { targetLabel: optionalString(input.canvasId) } : {}),
        reason: optionalString(input.reason),
        ...(doc ? { document: doc } : {}),
        ...(understandingTitles?.length ? { understandingTitles } : {}),
        ...(understandingRefs.size ? { understandingRefs } : {}),
      },
    };
  }
  return {
    ...base,
    kind: "unknown",
    content: {
      fields: Object.entries(input).flatMap(([key, value]) =>
        key === "proposalType" || value === undefined
          ? []
          : [
              {
                id: `${raw.approvalId}:${key}`,
                label: key,
                value: {
                  format:
                    key === "body" || key === "content" ? ("markdown" as const) : ("text" as const),
                  value: proposalValue(value),
                },
              },
            ],
      ),
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
    ...(blocks[0]?.createdAt ? { createdAt: blocks[0].createdAt } : {}),
  };
}

/** lookup 分组只收录真实工具面里「查资料」类的精确名字（省前缀猜测）。 */
const LOOKUP_TOOL_NAMES: ReadonlySet<PiToolName> = new Set([
  "read",
  "attachment_read",
  "web_search",
  "fetch_content",
  "get_search_content",
  "domain_list",
  "domain_inspect",
  "understanding_list",
  "understanding_get",
  "context_list",
  "context_get",
]);

function toolGroupType(name: string): ToolGroupType {
  return isPiToolName(name) && LOOKUP_TOOL_NAMES.has(name) ? "lookup" : "other";
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
  const failedItems = blocks.flatMap((block) =>
    block.state === "failed" ? [toolItemView(block)] : [],
  );
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
  return isPiToolName(name) ? PI_TOOL_LABELS[name] : "使用工具";
}

function queryLabel(input: Record<string, unknown>) {
  const query = stringValue(input.query).trim();
  if (query) return `「${query}」`;
  const queries = arrayValue(input.queries).flatMap((item) => {
    const query = stringValue(item).trim();
    return query ? [query] : [];
  });
  if (queries.length === 1) return `「${queries[0]}」`;
  return queries.length > 1 ? `「${queries[0]}」等 ${queries.length} 个查询` : "";
}

function quotedValue(value: unknown) {
  const text = stringValue(value).trim();
  return text ? `「${truncateText(text, 72)}」` : "";
}

function claimLabel(input: Record<string, unknown>) {
  const claim = stringValue(input.claim).trim();
  return claim ? `「${truncateText(claim, 60)}」` : "";
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

type ToolResultDetails = (
  output: unknown,
  input: Record<string, unknown>,
) => ToolActivityDetailsView;

/** 详情构造按工具名分派；键为 PiToolName union，覆盖完整性由测试锁定。 */
export const TOOL_RESULT_DETAILS: Partial<Record<PiToolName, ToolResultDetails>> = {
  retrieve_knowledge: (output) => retrievalCandidateDetails(output),
  attachment_read: (output) => attachmentReadDetails(output),
  read: (output) => readFileDetails(output),
  edit: (output) => editFileDetails(output),
  write: (_output, input) => writeFileDetails(input),
  bash: (output) => bashDetails(output),
  web_search: (output) => webAccessDetails(output),
  fetch_content: (output) => webAccessDetails(output),
  get_search_content: (output) => webAccessDetails(output),
  source_check: (output) => sourceCheckDetails(output),
  domain_list: (output) => domainListDetails(output),
  understanding_list: (output) => recordListDetails(output, "Understanding", "understandings"),
  context_list: (output) => recordListDetails(output, "Context", "contexts"),
  domain_inspect: (output) => inspectDomainDetails(output),
  understanding_get: (output) =>
    recordDetailView(entityRecord(output, "understanding"), "Understanding"),
  context_get: (output) => recordDetailView(entityRecord(output, "context"), "Context"),
  canvas_list: (output) => recordListDetails(output, "画布", "canvases"),
  canvas_read: (output) => recordDetailView(entityRecord(output, "canvas"), "画布"),
};

export function toolResultDetails(
  name: string,
  output: unknown,
  input: Record<string, unknown>,
): ToolActivityDetailsView {
  const handler = isPiToolName(name) ? TOOL_RESULT_DETAILS[name] : undefined;
  return handler ? handler(output, input) : detailView({});
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

function readFileDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const content = stringValue(output.content);
  return detailView({
    rows: content
      ? [detailRow("", "", content, "code", codeLanguage(stringValue(output.path)))]
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

function sourceCheckDetails(output: unknown) {
  const claims = isRecord(output) ? arrayValue(output.claims) : [];
  return detailView({
    rows: claims.flatMap((claim) => {
      if (!isRecord(claim)) return [];
      const known = stringValue(claim.status);
      const status = (SOURCE_CHECK_STATUS_LABELS[known] ?? known) || "";
      const passages =
        arrayValue(claim.supporting_passages).length +
        arrayValue(claim.contradicting_passages).length;
      const rationale = stringValue(claim.rationale);
      return [
        detailRow(status || "核验", undefined, passageCountText(rationale, passages), "markdown"),
      ];
    }),
    emptyText: claims.length === 0 ? "没有可用的核验结论。" : undefined,
  });
}

function passageCountText(rationale: string, passages: number): string | undefined {
  if (!rationale && passages === 0) return undefined;
  return passages > 0 ? `${rationale}（${passages} 条引文）` : rationale;
}

const SOURCE_CHECK_STATUS_LABELS: Record<string, string> = {
  supported: "支持",
  contradicted: "反驳",
  unclear: "存疑",
};

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
        undefined,
        "list-item",
        2,
      ),
      // A1：matches 里的 Context 命中作为证据展示
      ...arrayValue(candidate.matches).flatMap((match) =>
        isRecord(match) && match.entityType === "context"
          ? [
              detailRow(
                "Context 证据",
                contextTitle(match),
                stringValue(match.snippet),
                "markdown",
                undefined,
                "nested-list-item",
                1,
              ),
            ]
          : [],
      ),
    ];
  });
  return detailView({
    rows,
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
    rows: records.flatMap((record) => {
      if (!isRecord(record)) return [];
      return [
        detailRow(
          label,
          label === "Context" ? contextTitle(record) : entityTitle(record),
          recordText(record),
          "markdown",
          undefined,
          "list-item",
          2,
        ),
        ...arrayValue(contextsByUnderstandingId[stringValue(record.id)]).map((context) =>
          isRecord(context)
            ? detailRow(
                "Context",
                contextTitle(context),
                undefined,
                "text",
                undefined,
                "nested-list-item",
              )
            : undefined,
        ),
      ];
    }),
    emptyText: records.length === 0 ? "没有找到相关内容。" : undefined,
  });
}

function inspectDomainDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const understandings = arrayValue(output.understandings);
  const contexts = arrayValue(output.contexts).filter(isRecord);
  const domains = arrayValue(output.domains);
  const contextsByUnderstandingId = new Map<string, Array<Record<string, unknown>>>();
  for (const context of contexts) {
    const understandingId = stringValue(context.understandingId);
    if (!understandingId) continue;
    const items = contextsByUnderstandingId.get(understandingId) ?? [];
    items.push(context);
    contextsByUnderstandingId.set(understandingId, items);
  }
  const attachedContexts = new Set<Record<string, unknown>>();
  return detailView({
    badges: domains.flatMap((domain) => {
      const title = isRecord(domain) ? entityTitle(domain) : undefined;
      return title ? [title] : [];
    }),
    rows: [
      ...understandings.flatMap((record) => {
        if (!isRecord(record)) return [];
        const nestedContexts = contextsByUnderstandingId.get(stringValue(record.id)) ?? [];
        nestedContexts.forEach((context) => attachedContexts.add(context));
        return [
          detailRow(
            "Understanding",
            entityTitle(record),
            recordText(record),
            "markdown",
            undefined,
            "list-item",
            2,
          ),
          ...nestedContexts.map((context) =>
            detailRow(
              "Context",
              contextTitle(context),
              undefined,
              "text",
              undefined,
              "nested-list-item",
            ),
          ),
        ];
      }),
      ...contexts.flatMap((context) =>
        attachedContexts.has(context)
          ? []
          : [
              detailRow(
                "Context",
                contextTitle(context),
                recordText(context),
                "markdown",
                undefined,
                "list-item",
                2,
              ),
            ],
      ),
    ],
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
        undefined,
        "list-item",
      ),
      ...arrayValue(record.contexts).map((context) =>
        isRecord(context)
          ? detailRow(
              "Context",
              contextTitle(context),
              undefined,
              "text",
              undefined,
              "nested-list-item",
            )
          : undefined,
      ),
      ...arrayValue(record.mentions).map((mention) =>
        isRecord(mention)
          ? detailRow("引用", mentionTitle(mention), stringValue(mention.rawText))
          : undefined,
      ),
    ].filter((row): row is ToolActivityDetailRow => Boolean(row)),
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
  appearance?: ToolActivityDetailRow["appearance"],
  previewLines?: number,
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
    ...(appearance ? { appearance } : {}),
    ...(previewLines ? { previewLines } : {}),
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

function truncateText(text: string, maxLength = 80) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

type ToolRunningSummary = (input: Record<string, unknown>) => string;

function fileReadRunningLabel(input: Record<string, unknown>) {
  const parameters = readParameterLabel(input);
  return `正在读取「${filenameFromPath(stringValue(input.path)) || "本地文件"}」${parameters ? ` · ${parameters}` : ""}`;
}

/** 运行态文案按工具名分派；键为 PiToolName union，覆盖完整性由测试锁定。 */
export const TOOL_RUNNING_SUMMARY: Partial<Record<PiToolName, ToolRunningSummary>> = {
  image_generate: () => "正在生成图片",
  web_search: (input) => `正在搜索网页${queryLabel(input)}`,
  source_check: (input) => `正在核验观点${claimLabel(input)}`,
  retrieve_knowledge: (input) => `正在检索${queryLabel(input) || "知识"}`,
  read: fileReadRunningLabel,
  edit: (input) => `正在编辑「${filenameFromPath(stringValue(input.path)) || "本地文件"}」`,
  write: (input) => `正在写入「${filenameFromPath(stringValue(input.path)) || "本地文件"}」`,
  bash: (input) => `正在执行 Bash${quotedValue(input.command)}`,
  fetch_content: (input) => `正在读取网页${webSourceLabel(input)}`,
  get_search_content: (input) => `正在读取${searchContentTarget(input) || "已保存的搜索内容"}`,
  domain_list: () => "正在列出 Domain",
  domain_inspect: (input) => `正在查看 Domain${quotedValue(input.domainId)}`,
  understanding_list: () => "正在列出 Understanding",
  understanding_get: (input) => `正在读取 Understanding${quotedValue(input.understandingId)}`,
  context_list: (input) => `正在列出 Understanding${quotedValue(input.understandingId)}的 Context`,
  context_get: (input) => `正在读取 Context${quotedValue(input.contextId)}`,
  attachment_read: () => "正在读取附件",
  canvas_list: () => "正在列出画布",
  canvas_read: (input) => `正在读取画布${quotedValue(input.canvasId)}`,
  canvas_search: () => "正在搜索画布",
  canvas_present: () => "正在展示画布视图",
};

export function toolRunningSummary(name: string, input: Record<string, unknown>): string {
  const handler = isPiToolName(name) ? TOOL_RUNNING_SUMMARY[name] : undefined;
  return handler ? handler(input) : `正在使用「${name}」`;
}

function toolFailedSummary(name: string, input: Record<string, unknown>) {
  const [action, ...meta] = toolRunningSummary(name, input)
    .replace(/^正在/, "")
    .split(" · ");
  return `${action}失败${meta.length > 0 ? ` · ${meta.join(" · ")}` : ""}`;
}

type ToolDoneSummary = (input: Record<string, unknown>, output: unknown) => string;

function objectOutput(output: unknown): Record<string, unknown> {
  return isRecord(output) ? output : {};
}

function fileReadDoneLabel(input: Record<string, unknown>) {
  const path = stringValue(input.path);
  const parameters = readParameterLabel(input);
  return `读取了「${filenameFromPath(path) || "本地文件"}」${parameters ? ` · ${parameters}` : ""}`;
}

function domainInspectDoneLabel(input: Record<string, unknown>, output: unknown) {
  const outputRecord = objectOutput(output);
  const target =
    entityTitle(outputRecord.domain) ||
    entityTitle(outputRecord) ||
    stringValue(input.domainId) ||
    "Domain";
  const understandings = outputCount(output, "understandings");
  const contexts = outputCount(output, "contexts");
  return `查看 Domain「${target}」 · ${understandings} 条 Understanding / ${contexts} 条 Context`;
}

function understandingListDoneLabel(input: Record<string, unknown>, output: unknown) {
  const domainIds = stringArray(input.domainIds);
  const domainCount = domainIds.length;
  const domainIdSet = new Set(domainIds);
  const understandings = Array.isArray(output)
    ? output
    : isRecord(output)
      ? arrayValue(output.understandings)
      : [];
  const domainNames = [
    ...new Set(
      understandings.flatMap((understanding) =>
        isRecord(understanding)
          ? arrayValue(understanding.domains).flatMap((domain) => {
              const title =
                isRecord(domain) && domainIdSet.has(stringValue(domain.id))
                  ? entityTitle(domain)
                  : undefined;
              return title ? [title] : [];
            })
          : [],
      ),
    ),
  ];
  const domainLabel =
    domainNames.length === 1
      ? `「${domainNames[0]}」下的 `
      : domainNames.length > 1
        ? `「${domainNames[0]}」等 ${domainNames.length} 个 Domain 下的 `
        : domainCount > 0
          ? ` ${domainCount} 个 Domain 下的 `
          : " ";
  return `列出${domainLabel}Understanding · ${outputCount(output, "understandings")} 条`;
}

function retrieveKnowledgeDoneLabel(input: Record<string, unknown>, output: unknown) {
  const counts = retrievalCandidateCounts(output);
  const query = queryLabel(input);
  return query
    ? `检索${query} · ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context 证据`
    : `检索到 ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context 证据`;
}

/** 完成态文案按工具名分派；键为 PiToolName union，覆盖完整性由测试锁定。 */
export const TOOL_DONE_SUMMARY: Partial<Record<PiToolName, ToolDoneSummary>> = {
  image_generate: () => "已生成图片",
  source_check: (input, output) => {
    const claim = stringValue(input.claim).trim();
    const results = isRecord(output) ? arrayValue(output.results) : [];
    return `已核验观点${claim ? `「${truncateText(claim, 60)}」` : ""}${results.length > 0 ? ` · ${results.length} 个来源` : ""}`;
  },
  read: fileReadDoneLabel,
  edit: (input) => `编辑了「${filenameFromPath(stringValue(input.path)) || "本地文件"}」`,
  write: (input) => `写入了「${filenameFromPath(stringValue(input.path)) || "本地文件"}」`,
  attachment_read: (input, output) => {
    const target = stringValue(objectOutput(output).filename) || stringValue(input.attachmentId);
    return `读取了附件${target ? `「${target}」` : ""}`;
  },
  web_search: (input, output) => {
    const results = numberValue(objectOutput(output).totalResults);
    return `搜索网页${queryLabel(input)}${results === undefined ? "" : ` · ${results} 个来源`}`;
  },
  fetch_content: (input, output) => {
    const outputRecord = objectOutput(output);
    const title = stringValue(outputRecord.title).trim();
    const urlCount = numberValue(outputRecord.urlCount) ?? webSourceCount(input);
    const successful = numberValue(outputRecord.successful);
    if (title) return `读取网页「${truncateText(title, 60)}」`;
    if (urlCount > 1) {
      return `读取 ${urlCount} 个网页来源${successful === undefined ? "" : ` · ${successful} 个成功`}`;
    }
    return `读取网页${webSourceLabel(input)}`;
  },
  get_search_content: (input, output) => {
    const outputRecord = objectOutput(output);
    const title = stringValue(outputRecord.title).trim();
    const target = title ? `网页「${truncateText(title, 60)}」` : searchContentTarget(input);
    const count = numberValue(outputRecord.resultCount);
    return `读取${target || "已保存的搜索内容"}${count === undefined ? "" : ` · ${count} 个来源`}`;
  },
  bash: (input, output) => {
    const command = stringValue(input.command).trim();
    const exitCode = numberValue(objectOutput(output).exitCode);
    return `执行 Bash${command ? `「${truncateText(command, 72)}」` : ""}${exitCode === undefined ? "" : ` · 退出码 ${exitCode}`}`;
  },
  domain_list: (_input, output) => `列出 Domain · ${outputCount(output, "domains")} 个`,
  domain_inspect: domainInspectDoneLabel,
  understanding_list: understandingListDoneLabel,
  retrieve_knowledge: retrieveKnowledgeDoneLabel,
  understanding_get: (input, output) => {
    const outputRecord = objectOutput(output);
    return `读取了「${entityTitle(outputRecord.understanding) || entityTitle(outputRecord) || stringValue(input.understandingId) || "Understanding"}」`;
  },
  context_list: (input, output) =>
    `列出 Understanding「${stringValue(input.understandingId) || "未知"}」的 Context · ${outputCount(output, "contexts")} 条`,
  context_get: (input, output) => {
    const outputRecord = objectOutput(output);
    return `读取了「${entityTitle(outputRecord.context) || entityTitle(outputRecord) || stringValue(input.contextId) || "Context"}」`;
  },
  canvas_list: (_input, output) => {
    const count = Array.isArray(output) ? output.length : outputCount(output, "canvases");
    return `列出画布 · ${count} 个`;
  },
  canvas_read: (_input, output) =>
    `读取了画布「${entityTitle(objectOutput(output).canvas) || "画布"}」`,
  canvas_search: (input) => `搜索画布${queryLabel(input)}`,
  canvas_present: (input) => {
    const title = stringValue(input.title).trim();
    return `展示了画布视图${title ? `「${truncateText(title, 60)}」` : ""}`;
  },
};

export function toolDoneSummary(
  name: string,
  input: Record<string, unknown>,
  output: unknown,
): string {
  const handler = isPiToolName(name) ? TOOL_DONE_SUMMARY[name] : undefined;
  return handler ? handler(input, output) : `使用工具「${name}」`;
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

function mentionTitle(value: Record<string, unknown>) {
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

function retrievalCandidateCounts(output: unknown) {
  const candidates = isRecord(output) ? arrayValue(output.candidates) : [];
  let contexts = 0;
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    contexts += arrayValue(candidate.matches).filter(
      (match) => isRecord(match) && match.entityType === "context",
    ).length;
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
