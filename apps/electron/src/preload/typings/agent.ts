export type AgentContextRef = {
  type: "understanding" | "context" | "domain";
  id: string;
  title?: string;
};

export type AgentTextPart =
  | { type: "text"; text: string }
  | {
      type: "entity_ref";
      entityType: AgentContextRef["type"];
      entityId: string;
      fallbackText?: string;
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

export type AgentReasoningLevel = "default" | "low" | "medium" | "high" | "xhigh";

export type AgentFileAttachment = {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
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
};

export type AgentUserMessage = AgentEventBase & {
  type: "user.message";
  messageId: string;
  text: string;
  contextRefs?: AgentContextRef[];
  files?: AgentFileAttachment[];
  composerContent?: AgentComposerContentNode;
};

export type AgentEntitySource = {
  sourceId: string;
  entity: AgentContextRef;
  origin:
    | { kind: "user_context"; messageId: string }
    | { kind: "tool_result"; toolCallId: string; toolName: string };
};

export type AgentEntitySourcesUpdated = AgentEventBase & {
  type: "entity.sources.updated";
  sources: AgentEntitySource[];
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
};

export type AgentApprovalResolved = AgentEventBase & {
  type: "approval.resolved";
  runId: string;
  messageId: string;
  approvalId: string;
  toolCallId: string;
  toolName: string;
  approved: boolean;
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
  | AgentToolStarted
  | AgentToolCompleted
  | AgentToolFailed;

export type AgentSessionEvent =
  | AgentRunStarted
  | AgentRunCompleted
  | AgentRunFailed
  | AgentRunCancelled
  | AgentUserMessage
  | AgentEntitySourcesUpdated
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
      output?: unknown;
      error?: string;
      executionError?: AgentToolExecutionError;
      approved?: boolean;
      state: "pending" | "approved" | "rejected" | "completed" | "failed";
      approvalState: AgentToolApprovalState;
      executionState: AgentToolExecutionState;
      displayState: AgentToolDisplayState;
      createdAt: string;
    }
  | {
      kind: "text";
      text: string;
      parts?: AgentTextPart[];
      createdAt: string;
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
      type: "tool.approve";
      sessionId: string;
      approvalId: string;
    }
  | {
      type: "tool.reject";
      sessionId: string;
      approvalId: string;
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

export type AgentReducedMessage = {
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

type AgentApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;

export type AgentSessionState = {
  sessionId: string | null;
  messages: AgentReducedMessage[];
  activeRunId: string | null;
  status: "idle" | "running" | "failed" | "cancelled";
  error: string | null;
  entitySources: AgentEntitySource[];
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
      "entity.sources.updated",
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
      "tool.started",
      "tool.completed",
      "tool.failed",
    ].includes(value.type)
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
  const nextMessage: AgentReducedMessage = {
    id: event.messageId,
    role: "assistant",
    text: event.text,
    runId: event.runId,
    createdAt: event.createdAt,
    blocks: mergeAssistantTurnBlocks(event.blocks, existing?.blocks),
    usage: event.usage,
    contextUsage: event.contextUsage,
    model: event.model,
    stopReason: event.stopReason,
  };
  if (index < 0) return [...messages, nextMessage];
  return messages.map((message, messageIndex) => (messageIndex === index ? nextMessage : message));
}

function mergeEntitySources(
  current: AgentEntitySource[],
  incoming: AgentEntitySource[],
): AgentEntitySource[] {
  const next = [...current];
  for (const source of incoming) {
    const index = next.findIndex((item) => item.sourceId === source.sourceId);
    if (index < 0) next.push(source);
    else next[index] = source;
  }
  return next;
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
        { kind: "reasoning" as const, text: event.delta, createdAt: event.createdAt },
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
    if (event.type === "tool.started") {
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

    const approvalIndex = blocks.findIndex(
      (block) => block.kind === "approval" && block.toolCallId === event.toolCallId,
    );
    if (approvalIndex >= 0) return blocks;

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
  if (approvalState === "rejected") return "rejected";
  if (approvalState === "pending") return "pending_approval";
  if (executionState === "failed") return "failed";
  if (executionState === "completed") return "completed";
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
  entitySources: [],
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

  if (event.type === "entity.sources.updated") {
    return {
      ...state,
      sessionId: event.sessionId,
      entitySources: mergeEntitySources(state.entitySources, event.sources),
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

  if (event.type === "approval.requested" || event.type === "approval.resolved") {
    return {
      ...state,
      sessionId: event.sessionId,
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
    };
  }

  return state;
}

export function reduceAgentSession(events: AgentEvent[]): AgentSessionState {
  return events.reduce<AgentSessionState>(reduceAgentSessionEvent, initialAgentSessionState);
}
