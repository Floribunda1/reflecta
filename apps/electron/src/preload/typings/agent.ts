export type AgentContextRef = {
  type: "understanding" | "context" | "domain";
  id: string;
  title?: string;
};

export type AgentComposerContentNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AgentComposerContentNode[];
};

export type AgentModelSelection = {
  providerId: string;
  modelId: string;
};

export type AgentUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
};

export type AgentContextUsage = {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
};

export type AgentReasoningLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type AgentFileAttachment = {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
  /** 本地磁盘路径（用户选择/拖拽的文件；粘贴等来源为空）。用于系统应用打开。 */
  filePath?: string;
  providerMetadata?: Record<string, unknown>;
};

export type AgentSessionSummary = {
  id: string;
  title: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  runtime: "pi";
};

export type AgentEventBase = {
  id: string;
  sessionId: string;
  runId?: string;
  createdAt: string;
};

export type AgentRunStarted = AgentEventBase & {
  type: "run.started";
  runId: string;
};

export type AgentRunCompleted = AgentEventBase & {
  type: "run.completed";
  runId: string;
};

export type AgentRunFailed = AgentEventBase & {
  type: "run.failed";
  runId: string;
  error: string;
};

export type AgentRunCancelled = AgentEventBase & {
  type: "run.cancelled";
  runId: string;
  /** Assistant message of the cancelled run, when it produced any content. */
  assistantMessageId?: string;
};

export type AgentUserMessage = AgentEventBase & {
  type: "user.message";
  messageId: string;
  text: string;
  contextRefs?: AgentContextRef[];
  files?: AgentFileAttachment[];
  composerContent?: AgentComposerContentNode;
};

export type AgentEntityCatalogEntry = {
  key: string;
  entity: AgentContextRef;
  origin:
    | { kind: "user_context"; messageId: string }
    | { kind: "tool_result"; toolCallId: string; toolName: string };
};

export type AgentEntityCatalogUpdated = AgentEventBase & {
  type: "entity.catalog.updated";
  entries: AgentEntityCatalogEntry[];
};

export type AgentContextCompactionReason = "manual" | "threshold" | "overflow";

export type AgentContextCompactionStarted = AgentEventBase & {
  type: "context.compaction.started";
  reason: AgentContextCompactionReason;
};

export type AgentContextCompactionFinished = AgentEventBase & {
  type: "context.compaction.finished";
  reason: AgentContextCompactionReason;
  error?: string;
};

export type AgentContextCompacted = AgentEventBase & {
  type: "context.compacted";
  reason: AgentContextCompactionReason;
  messageId?: string;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  estimatedTokensAfter?: number;
  contextWindow?: number;
  afterMessageId?: string;
};

export type AgentAssistantTextDelta = AgentEventBase & {
  type: "assistant.text.delta";
  runId: string;
  messageId: string;
  delta: string;
};

export type AgentAssistantReasoningDelta = AgentEventBase & {
  type: "assistant.reasoning.delta";
  runId: string;
  messageId: string;
  delta: string;
};

export type AgentToolStarted = AgentEventBase & {
  type: "tool.started";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  input?: unknown;
};

export type AgentToolCompleted = AgentEventBase & {
  type: "tool.completed";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  output?: unknown;
};

export type AgentToolFailed = AgentEventBase & {
  type: "tool.failed";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  error: string;
};

export type AgentToolExecutionError = {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

export type AgentToolExecutionStarted = AgentEventBase & {
  type: "tool.execution.started";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  input?: unknown;
};

export type AgentToolExecutionCompleted = AgentEventBase & {
  type: "tool.execution.completed";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  output?: unknown;
};

export type AgentToolExecutionFailed = AgentEventBase & {
  type: "tool.execution.failed";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  error: AgentToolExecutionError;
};

export type AgentApprovalRequested = AgentEventBase & {
  type: "approval.requested";
  runId: string;
  messageId: string;
  approvalId: string;
  toolCallId: string;
  toolName: string;
  title: string;
  description?: string;
  payload?: unknown;
  preview?: boolean;
};

export type AgentApprovalResolved = AgentEventBase & {
  type: "approval.resolved";
  runId: string;
  messageId: string;
  approvalId: string;
  toolCallId: string;
  toolName: string;
  approved: boolean;
  rejectionReason?: string;
};

export type AgentAssistantTurnBlock = AgentReducedAssistantBlock;

export type AgentToolApprovalState = "pending" | "approved" | "rejected";
export type AgentToolExecutionState = "not_started" | "running" | "completed" | "failed";
export type AgentToolDisplayState =
  | "pending_approval"
  | "rejected"
  | "running"
  | "completed"
  | "failed";

export type AgentAssistantTurn = AgentEventBase & {
  type: "assistant.turn";
  runId: string;
  messageId: string;
  blocks: AgentAssistantTurnBlock[];
  text: string;
  usage?: AgentUsage;
  contextUsage?: AgentContextUsage;
  model?: AgentModelSelection;
  stopReason?: string;
};

export type AgentLiveEvent =
  | AgentAssistantTextDelta
  | AgentAssistantReasoningDelta
  | AgentContextCompactionStarted
  | AgentContextCompactionFinished
  | AgentToolStarted
  | AgentToolCompleted
  | AgentToolFailed;

export type AgentSessionEvent =
  | AgentRunStarted
  | AgentRunCompleted
  | AgentRunFailed
  | AgentRunCancelled
  | AgentUserMessage
  | AgentEntityCatalogUpdated
  | AgentContextCompacted
  | AgentAssistantTurn
  | AgentApprovalRequested
  | AgentApprovalResolved
  | AgentToolExecutionStarted
  | AgentToolExecutionCompleted
  | AgentToolExecutionFailed;

export type AgentEvent = AgentSessionEvent | AgentLiveEvent;

export type AgentReducedAssistantBlock =
  | {
      kind: "reasoning";
      text: string;
      createdAt: string;
    }
  | {
      kind: "tool";
      toolCallId: string;
      toolName: string;
      input?: unknown;
      output?: unknown;
      error?: string;
      state: "running" | "completed" | "failed";
      createdAt: string;
    }
  | {
      kind: "approval";
      approvalId: string;
      toolCallId: string;
      toolName: string;
      title: string;
      description?: string;
      payload?: unknown;
      preview?: boolean;
      output?: unknown;
      error?: string;
      executionError?: AgentToolExecutionError;
      approved?: boolean;
      rejectionReason?: string;
      state: "pending" | "approved" | "rejected" | "completed" | "failed";
      approvalState: AgentToolApprovalState;
      executionState: AgentToolExecutionState;
      displayState: AgentToolDisplayState;
      createdAt: string;
    }
  | {
      kind: "text";
      text: string;
      state?: "streaming" | "done" | "failed";
      error?: string;
      createdAt: string;
    }
  | {
      kind: "context-compaction";
      compaction: AgentContextCompacted;
    };

export type AgentCommand =
  | {
      type: "session.create";
      title?: string;
    }
  | {
      type: "message.send";
      sessionId: string;
      text: string;
      messageId?: string;
      contextRefs?: AgentContextRef[];
      files?: AgentFileAttachment[];
      composerContent?: AgentComposerContentNode;
      modelSelection?: AgentModelSelection;
      reasoningLevel?: AgentReasoningLevel;
    }
  | {
      type: "run.cancel";
      sessionId: string;
    }
  | {
      type: "context.compact";
      sessionId: string;
      modelSelection?: AgentModelSelection;
      reasoningLevel?: AgentReasoningLevel;
    }
  | {
      type: "tool.approve";
      sessionId: string;
      approvalId: string;
      modelSelection?: AgentModelSelection;
      reasoningLevel?: AgentReasoningLevel;
    }
  | {
      type: "tool.reject";
      sessionId: string;
      approvalId: string;
      reason?: string;
      modelSelection?: AgentModelSelection;
      reasoningLevel?: AgentReasoningLevel;
    }
  | {
      type: "session.rename";
      sessionId: string;
      title: string;
    }
  | {
      type: "session.delete";
      sessionId: string;
    };

export type AgentMessageProjection = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  runId?: string;
  blocks?: AgentReducedAssistantBlock[];
  contextRefs?: AgentContextRef[];
  files?: AgentFileAttachment[];
  composerContent?: AgentComposerContentNode;
  usage?: AgentUsage;
  contextUsage?: AgentContextUsage;
  model?: AgentModelSelection;
  stopReason?: string;
};

/** @deprecated Use AgentMessageProjection. */
export type AgentReducedMessage = AgentMessageProjection;

type AgentApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;

export type AgentSessionState = {
  sessionId: string | null;
  messages: AgentReducedMessage[];
  activeRunId: string | null;
  status: "idle" | "running" | "waiting" | "failed" | "cancelled";
  error: string | null;
  entityCatalog: AgentEntityCatalogEntry[];
  contextCompactions: AgentContextCompacted[];
  activeCompaction: AgentContextCompactionStarted | null;
  compactionError: string | null;
  /**
   * Assistant message of the last cancelled run (if any). Lets the UI attach
   * the stopped marker to the cancelled turn instead of a previous reply.
   * Cleared when the next run starts.
   */
  cancelledAssistantMessageId: string | null;
};

export type AgentSessionProjection = Omit<AgentSessionState, "sessionId"> & {
  sessionId: string;
};

export type AgentSessionFeedError = {
  code: "SESSION_NOT_FOUND" | "SESSION_LOG_CORRUPT" | "TRANSPORT_CLOSED" | "PROJECTION_FAILED";
  message: string;
  retryable: boolean;
};

export type AgentSessionFeedFrame =
  | {
      kind: "state";
      sessionId: string;
      revision: number;
      session: AgentSessionProjection;
    }
  | {
      kind: "error";
      sessionId: string;
      error: AgentSessionFeedError;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isAgentSessionEvent(value: unknown): value is AgentSessionEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.type === "string" &&
    [
      "run.started",
      "run.completed",
      "run.failed",
      "run.cancelled",
      "user.message",
      "entity.catalog.updated",
      "context.compacted",
      "assistant.turn",
      "approval.requested",
      "approval.resolved",
      "tool.execution.started",
      "tool.execution.completed",
      "tool.execution.failed",
    ].includes(value.type)
  );
}

export function isAgentEvent(value: unknown): value is AgentEvent {
  if (isAgentSessionEvent(value)) return true;
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.type === "string" &&
    [
      "assistant.text.delta",
      "assistant.reasoning.delta",
      "context.compaction.started",
      "context.compaction.finished",
      "tool.started",
      "tool.completed",
      "tool.failed",
    ].includes(value.type)
  );
}

export function isAgentSessionFeedFrame(value: unknown): value is AgentSessionFeedFrame {
  if (!isRecord(value) || typeof value.sessionId !== "string") return false;
  if (value.kind === "state") {
    return (
      typeof value.revision === "number" &&
      Number.isInteger(value.revision) &&
      value.revision >= 0 &&
      isRecord(value.session) &&
      value.session.sessionId === value.sessionId &&
      Array.isArray(value.session.messages)
    );
  }
  return (
    value.kind === "error" &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string" &&
    typeof value.error.retryable === "boolean"
  );
}

function upsertAssistantText(
  messages: AgentReducedMessage[],
  event: AgentAssistantTextDelta,
): AgentReducedMessage[] {
  const index = messages.findIndex((message) => message.id === event.messageId);
  if (index < 0) {
    return [
      ...messages,
      {
        id: event.messageId,
        role: "assistant",
        text: event.delta,
        runId: event.runId,
        createdAt: event.createdAt,
        blocks: [{ kind: "text", text: event.delta, createdAt: event.createdAt }],
      },
    ];
  }

  return messages.map((message, messageIndex) =>
    messageIndex === index
      ? {
          ...message,
          text: message.text + event.delta,
          blocks: upsertTextBlock(message.blocks, event),
        }
      : message,
  );
}

function strongestApprovalState(
  left: AgentToolApprovalState,
  right: AgentToolApprovalState,
): AgentToolApprovalState {
  if (left === "rejected" || right === "rejected") return "rejected";
  if (left === "approved" || right === "approved") return "approved";
  return "pending";
}

const executionStateRank: Record<AgentToolExecutionState, number> = {
  not_started: 0,
  running: 1,
  completed: 2,
  failed: 3,
};

function strongestExecutionState(
  left: AgentToolExecutionState,
  right: AgentToolExecutionState,
): AgentToolExecutionState {
  return executionStateRank[left] >= executionStateRank[right] ? left : right;
}

function mergeApprovalBlockSnapshot(
  incoming: AgentApprovalBlock,
  existing?: AgentApprovalBlock,
): AgentApprovalBlock {
  const approvalState = existing
    ? strongestApprovalState(existing.approvalState, incoming.approvalState)
    : incoming.approvalState;
  const executionState =
    approvalState === "rejected"
      ? "not_started"
      : existing
        ? strongestExecutionState(existing.executionState, incoming.executionState)
        : incoming.executionState;
  const displayState = deriveDisplayState(approvalState, executionState);
  return {
    ...incoming,
    approved:
      approvalState === "pending"
        ? (incoming.approved ?? existing?.approved)
        : approvalState === "approved",
    ...(executionState === "completed" ? { output: incoming.output ?? existing?.output } : {}),
    ...(executionState === "failed"
      ? {
          error: existing?.error ?? incoming.error,
          executionError: existing?.executionError ?? incoming.executionError,
        }
      : {}),
    approvalState,
    executionState,
    displayState,
    state: approvalBlockState(displayState),
  };
}

function mergeAssistantTurnBlocks(
  incomingBlocks: AgentReducedAssistantBlock[],
  existingBlocks: AgentReducedAssistantBlock[] | undefined,
): AgentReducedAssistantBlock[] {
  return incomingBlocks.map((block) => {
    if (block.kind !== "approval") return block;
    const existing = existingBlocks?.find(
      (current): current is AgentApprovalBlock =>
        current.kind === "approval" &&
        (current.approvalId === block.approvalId || current.toolCallId === block.toolCallId),
    );
    return mergeApprovalBlockSnapshot(block, existing);
  });
}

function upsertAssistantTurn(
  messages: AgentReducedMessage[],
  event: AgentAssistantTurn,
): AgentReducedMessage[] {
  const index = messages.findIndex((message) => message.id === event.messageId);
  const existing = index >= 0 ? messages[index] : undefined;
  const compaction = event.blocks.findLast(
    (block): block is Extract<AgentReducedAssistantBlock, { kind: "context-compaction" }> =>
      block.kind === "context-compaction",
  )?.compaction;
  const compactedContextUsage =
    compaction?.estimatedTokensAfter !== undefined &&
    compaction.contextWindow !== undefined &&
    compaction.contextWindow > 0
      ? {
          tokens: compaction.estimatedTokensAfter,
          contextWindow: compaction.contextWindow,
          percent: Math.min(
            100,
            (compaction.estimatedTokensAfter / compaction.contextWindow) * 100,
          ),
        }
      : undefined;
  const nextMessage: AgentReducedMessage = {
    id: event.messageId,
    role: "assistant",
    text: event.text,
    runId: event.runId,
    createdAt: event.createdAt,
    blocks: mergeAssistantTurnBlocks(event.blocks, existing?.blocks),
    usage: event.usage,
    contextUsage:
      event.contextUsage?.tokens == null
        ? (compactedContextUsage ?? existing?.contextUsage ?? event.contextUsage)
        : event.contextUsage,
    model: event.model,
    stopReason: event.stopReason,
  };
  if (index < 0) return [...messages, nextMessage];
  return messages.map((message, messageIndex) => (messageIndex === index ? nextMessage : message));
}

function mergeEntityCatalog(
  current: AgentEntityCatalogEntry[],
  incoming: AgentEntityCatalogEntry[],
): AgentEntityCatalogEntry[] {
  const next = [...current];
  for (const entry of incoming) {
    const index = next.findIndex((item) => item.key === entry.key);
    if (index < 0) next.push(entry);
    else next[index] = entry;
  }
  return next;
}

function applyCompactedContextUsage(
  messages: AgentReducedMessage[],
  event: AgentContextCompacted,
): AgentReducedMessage[] {
  if (
    event.estimatedTokensAfter === undefined ||
    event.contextWindow === undefined ||
    event.contextWindow <= 0
  ) {
    return messages;
  }
  const estimatedTokensAfter = event.estimatedTokensAfter;
  const contextWindow = event.contextWindow;
  const assistantIndex = event.messageId
    ? messages.findIndex((message) => message.id === event.messageId)
    : messages.findLastIndex((message) => message.role === "assistant");
  if (assistantIndex < 0) return messages;
  return messages.map((message, index) =>
    index === assistantIndex
      ? {
          ...message,
          contextUsage: {
            tokens: estimatedTokensAfter,
            contextWindow,
            percent: Math.min(100, (estimatedTokensAfter / contextWindow) * 100),
          },
        }
      : message,
  );
}

function upsertAssistantCompaction(
  messages: AgentReducedMessage[],
  event: AgentContextCompacted,
): AgentReducedMessage[] {
  if (!event.messageId) return messages;
  const block = { kind: "context-compaction" as const, compaction: event };
  const index = messages.findIndex((message) => message.id === event.messageId);
  if (index < 0) {
    return [
      ...messages,
      {
        id: event.messageId,
        role: "assistant",
        text: "",
        runId: event.runId,
        createdAt: event.createdAt,
        blocks: [block],
      },
    ];
  }
  return messages.map((message, messageIndex) =>
    messageIndex === index
      ? {
          ...message,
          blocks: [...(message.blocks ?? []), block],
        }
      : message,
  );
}

function upsertTextBlock(
  blocks: AgentReducedAssistantBlock[] | undefined,
  event: AgentAssistantTextDelta,
): AgentReducedAssistantBlock[] {
  const next = blocks ?? [];
  const last = next.at(-1);
  if (last?.kind !== "text") {
    return [...next, { kind: "text", text: event.delta, createdAt: event.createdAt }];
  }
  return next.map((block, blockIndex) =>
    blockIndex === next.length - 1 && block.kind === "text"
      ? { ...block, text: block.text + event.delta }
      : block,
  );
}

function upsertAssistantReasoning(
  messages: AgentReducedMessage[],
  event: AgentAssistantReasoningDelta,
): AgentReducedMessage[] {
  return upsertAssistantBlock(messages, event, (blocks) => {
    const last = blocks.at(-1);
    if (last?.kind !== "reasoning") {
      return [
        ...blocks,
        {
          kind: "reasoning" as const,
          text: event.delta,
          createdAt: event.createdAt,
        },
      ];
    }
    return blocks.map((block, blockIndex) =>
      blockIndex === blocks.length - 1 && block.kind === "reasoning"
        ? { ...block, text: block.text + event.delta }
        : block,
    );
  });
}

function upsertAssistantTool(
  messages: AgentReducedMessage[],
  event: AgentToolStarted | AgentToolCompleted | AgentToolFailed,
): AgentReducedMessage[] {
  return upsertAssistantBlock(messages, event, (blocks) => {
    const index = blocks.findIndex(
      (block) => block.kind === "tool" && block.toolCallId === event.toolCallId,
    );
    const approvalIndex = blocks.findIndex(
      (block) => block.kind === "approval" && block.toolCallId === event.toolCallId,
    );
    if (event.type === "tool.started") {
      if (approvalIndex >= 0) {
        return blocks.map((block, blockIndex) => {
          if (blockIndex !== approvalIndex || block.kind !== "approval") return block;
          if (block.approvalState === "rejected") return block;
          const executionState = "running" as const;
          const displayState = deriveDisplayState(block.approvalState, executionState);
          return {
            ...block,
            executionState,
            displayState,
            state: approvalBlockState(displayState),
          };
        });
      }
      const block = {
        kind: "tool" as const,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        input: event.input,
        state: "running" as const,
        createdAt: event.createdAt,
      };
      if (index < 0) return [...blocks, block];
      return blocks.map((current, blockIndex) => (blockIndex === index ? block : current));
    }

    if (approvalIndex >= 0) {
      return blocks.map((block, blockIndex) => {
        if (blockIndex !== approvalIndex || block.kind !== "approval") return block;
        if (block.approvalState === "rejected") return block;
        const executionState = event.type === "tool.completed" ? "completed" : "failed";
        const displayState = deriveDisplayState(block.approvalState, executionState);
        return {
          ...block,
          ...(event.type === "tool.completed" ? { output: event.output } : { error: event.error }),
          executionState,
          displayState,
          state: approvalBlockState(displayState),
        };
      });
    }

    const update =
      event.type === "tool.completed"
        ? {
            state: "completed" as const,
            output: event.output,
          }
        : {
            state: "failed" as const,
            error: event.error,
          };
    if (index < 0) {
      return [
        ...blocks,
        {
          kind: "tool" as const,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          ...update,
          createdAt: event.createdAt,
        },
      ];
    }
    return blocks.map((block, blockIndex) =>
      blockIndex === index && block.kind === "tool" ? { ...block, ...update } : block,
    );
  });
}

function errorMessage(error: AgentToolExecutionError): string {
  return error.message || "Tool execution failed";
}

function deriveDisplayState(
  approvalState: AgentToolApprovalState,
  executionState: AgentToolExecutionState,
): AgentToolDisplayState {
  if (executionState === "failed") return "failed";
  if (executionState === "completed") return "completed";
  if (approvalState === "rejected") return "rejected";
  if (approvalState === "pending") return "pending_approval";
  return "running";
}

function approvalBlockState(
  displayState: AgentToolDisplayState,
): Extract<AgentReducedAssistantBlock, { kind: "approval" }>["state"] {
  if (displayState === "pending_approval") return "pending";
  if (displayState === "rejected") return "rejected";
  if (displayState === "completed") return "completed";
  if (displayState === "failed") return "failed";
  return "approved";
}

function upsertAssistantToolExecution(
  messages: AgentReducedMessage[],
  event: AgentToolExecutionStarted | AgentToolExecutionCompleted | AgentToolExecutionFailed,
): AgentReducedMessage[] {
  return upsertAssistantBlock(messages, event, (blocks) => {
    const index = blocks.findIndex(
      (block) => block.kind === "approval" && block.toolCallId === event.toolCallId,
    );
    if (index < 0) return blocks;
    return blocks.map((block, blockIndex) => {
      if (blockIndex !== index || block.kind !== "approval") return block;
      const approvalState = block.approvalState;
      const executionState: AgentToolExecutionState =
        event.type === "tool.execution.started"
          ? "running"
          : event.type === "tool.execution.completed"
            ? "completed"
            : "failed";
      const displayState = deriveDisplayState(approvalState, executionState);
      return {
        ...block,
        ...(event.type === "tool.execution.completed" ? { output: event.output } : {}),
        ...(event.type === "tool.execution.failed"
          ? { error: errorMessage(event.error), executionError: event.error }
          : {}),
        approvalState,
        executionState,
        displayState,
        state: approvalBlockState(displayState),
      };
    });
  });
}

function upsertAssistantApproval(
  messages: AgentReducedMessage[],
  event: AgentApprovalRequested | AgentApprovalResolved,
): AgentReducedMessage[] {
  return upsertAssistantBlock(messages, event, (blocks) => {
    const index = blocks.findIndex(
      (block) => block.kind === "approval" && block.approvalId === event.approvalId,
    );
    if (event.type === "approval.requested") {
      const block = {
        kind: "approval" as const,
        approvalId: event.approvalId,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        title: event.title,
        description: event.description,
        payload: event.payload,
        preview: event.preview,
        state: "pending" as const,
        approvalState: "pending" as const,
        executionState: "not_started" as const,
        displayState: "pending_approval" as const,
        createdAt: event.createdAt,
      };
      if (index < 0) return [...blocks, block];
      return blocks.map((current, blockIndex) => (blockIndex === index ? block : current));
    }
    if (index < 0) return blocks;
    return blocks.map((block, blockIndex) => {
      if (blockIndex !== index || block.kind !== "approval") return block;
      const approvalState = event.approved ? "approved" : "rejected";
      const executionState = block.executionState;
      const displayState = deriveDisplayState(approvalState, executionState);
      return {
        ...block,
        approved: event.approved,
        rejectionReason: event.rejectionReason,
        approvalState,
        executionState,
        displayState,
        state: approvalBlockState(displayState),
      };
    });
  });
}

function upsertAssistantBlock(
  messages: AgentReducedMessage[],
  event:
    | AgentAssistantReasoningDelta
    | AgentToolStarted
    | AgentToolCompleted
    | AgentToolFailed
    | AgentToolExecutionStarted
    | AgentToolExecutionCompleted
    | AgentToolExecutionFailed
    | AgentApprovalRequested
    | AgentApprovalResolved,
  reduceBlocks: (blocks: AgentReducedAssistantBlock[]) => AgentReducedAssistantBlock[],
): AgentReducedMessage[] {
  const index = messages.findIndex((message) => message.id === event.messageId);
  if (index < 0) {
    return [
      ...messages,
      {
        id: event.messageId,
        role: "assistant",
        text: "",
        runId: event.runId,
        createdAt: event.createdAt,
        blocks: reduceBlocks([]),
      },
    ];
  }
  return messages.map((message, messageIndex) =>
    messageIndex === index ? { ...message, blocks: reduceBlocks(message.blocks ?? []) } : message,
  );
}

export const initialAgentSessionState: AgentSessionState = {
  sessionId: null,
  messages: [],
  activeRunId: null,
  status: "idle",
  error: null,
  entityCatalog: [],
  contextCompactions: [],
  activeCompaction: null,
  compactionError: null,
  cancelledAssistantMessageId: null,
};

export function reduceAgentSessionEvent(
  state: AgentSessionState,
  event: AgentEvent,
): AgentSessionState {
  if (event.type === "run.started") {
    return {
      ...state,
      sessionId: event.sessionId,
      activeRunId: event.runId,
      status: "running",
      error: null,
      cancelledAssistantMessageId: null,
    };
  }

  if (event.type === "user.message") {
    const nextUserMessage = {
      id: event.messageId,
      role: "user" as const,
      text: event.text,
      createdAt: event.createdAt,
      contextRefs: event.contextRefs,
      files: event.files,
      composerContent: event.composerContent,
    };
    const existingIndex = state.messages.findIndex((message) => message.id === event.messageId);
    return {
      ...state,
      sessionId: event.sessionId,
      messages:
        existingIndex < 0
          ? [...state.messages, nextUserMessage]
          : [...state.messages.slice(0, existingIndex), nextUserMessage],
    };
  }

  if (event.type === "entity.catalog.updated") {
    return {
      ...state,
      sessionId: event.sessionId,
      entityCatalog: mergeEntityCatalog(state.entityCatalog, event.entries),
    };
  }

  if (event.type === "context.compaction.started") {
    return {
      ...state,
      sessionId: event.sessionId,
      activeCompaction: event,
      compactionError: null,
    };
  }

  if (event.type === "context.compaction.finished") {
    return {
      ...state,
      sessionId: event.sessionId,
      activeCompaction: null,
      compactionError: event.error ?? null,
    };
  }

  if (event.type === "context.compacted") {
    const existingIndex = state.contextCompactions.findIndex(
      (compaction) => compaction.id === event.id,
    );
    const messages = applyCompactedContextUsage(
      upsertAssistantCompaction(state.messages, event),
      event,
    );
    return {
      ...state,
      sessionId: event.sessionId,
      messages,
      contextCompactions: event.messageId
        ? state.contextCompactions
        : existingIndex < 0
          ? [...state.contextCompactions, event]
          : state.contextCompactions.map((compaction, index) =>
              index === existingIndex ? event : compaction,
            ),
      activeCompaction: null,
      compactionError: null,
    };
  }

  if (event.type === "assistant.text.delta") {
    return {
      ...state,
      sessionId: event.sessionId,
      messages: upsertAssistantText(state.messages, event),
    };
  }

  if (event.type === "assistant.turn") {
    return {
      ...state,
      sessionId: event.sessionId,
      messages: upsertAssistantTurn(state.messages, event),
    };
  }

  if (event.type === "assistant.reasoning.delta") {
    return {
      ...state,
      sessionId: event.sessionId,
      messages: upsertAssistantReasoning(state.messages, event),
    };
  }

  if (
    event.type === "tool.started" ||
    event.type === "tool.completed" ||
    event.type === "tool.failed"
  ) {
    return {
      ...state,
      sessionId: event.sessionId,
      messages: upsertAssistantTool(state.messages, event),
    };
  }

  if (
    event.type === "tool.execution.started" ||
    event.type === "tool.execution.completed" ||
    event.type === "tool.execution.failed"
  ) {
    return {
      ...state,
      sessionId: event.sessionId,
      messages: upsertAssistantToolExecution(state.messages, event),
    };
  }

  if (event.type === "approval.requested") {
    const waiting = !event.preview;
    return {
      ...state,
      sessionId: event.sessionId,
      messages: upsertAssistantApproval(state.messages, event),
      ...(waiting ? { activeRunId: null, status: "waiting" as const, error: null } : {}),
    };
  }

  if (event.type === "approval.resolved") {
    return {
      ...state,
      sessionId: event.sessionId,
      activeRunId: event.runId,
      status: "running",
      error: null,
      messages: upsertAssistantApproval(state.messages, event),
    };
  }

  if (event.type === "run.completed") {
    return {
      ...state,
      sessionId: event.sessionId,
      activeRunId: null,
      status: "idle",
      error: null,
    };
  }

  if (event.type === "run.failed") {
    return {
      ...state,
      sessionId: event.sessionId,
      activeRunId: null,
      status: "failed",
      error: event.error,
    };
  }

  if (event.type === "run.cancelled") {
    return {
      ...state,
      sessionId: event.sessionId,
      activeRunId: null,
      status: "cancelled",
      error: null,
      cancelledAssistantMessageId: event.assistantMessageId ?? null,
    };
  }

  return state;
}

export function reduceAgentSession(events: AgentEvent[]): AgentSessionState {
  const restoredEvents = [...events];
  for (let index = 0; index < restoredEvents.length - 1; index += 1) {
    const event = restoredEvents[index];
    const nextEvent = restoredEvents[index + 1];
    if (
      event?.type !== "context.compacted" ||
      event.messageId ||
      nextEvent?.type !== "assistant.turn" ||
      (event.runId !== undefined && event.runId !== nextEvent.runId)
    ) {
      continue;
    }

    const compaction: AgentContextCompacted = {
      ...event,
      runId: nextEvent.runId,
      messageId: nextEvent.messageId,
      afterMessageId: undefined,
    };
    const compactionBlock: AgentReducedAssistantBlock = {
      kind: "context-compaction",
      compaction,
    };
    const insertAt = nextEvent.blocks.findIndex((block) => {
      const createdAt =
        block.kind === "context-compaction" ? block.compaction.createdAt : block.createdAt;
      return createdAt > compaction.createdAt;
    });
    const blocks = nextEvent.blocks.some(
      (block) => block.kind === "context-compaction" && block.compaction.id === compaction.id,
    )
      ? nextEvent.blocks
      : insertAt < 0
        ? [...nextEvent.blocks, compactionBlock]
        : [
            ...nextEvent.blocks.slice(0, insertAt),
            compactionBlock,
            ...nextEvent.blocks.slice(insertAt),
          ];

    restoredEvents[index] = compaction;
    restoredEvents[index + 1] = { ...nextEvent, blocks };
  }

  return restoredEvents.reduce<AgentSessionState>(
    reduceAgentSessionEvent,
    initialAgentSessionState,
  );
}

export function projectAgentSessionEvents(
  sessionId: string,
  events: readonly AgentEvent[],
): AgentSessionProjection {
  return {
    ...reduceAgentSession([...events]),
    sessionId,
  };
}
