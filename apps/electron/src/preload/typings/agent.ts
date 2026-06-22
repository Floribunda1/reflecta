export type AgentContextRef = {
  type: "thought" | "context" | "category";
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

export type AgentApprovalRequested = AgentEventBase & {
  type: "approval.requested";
  runId: string;
  approvalId: string;
  toolCallId: string;
  title: string;
  description?: string;
  payload?: unknown;
};

export type AgentApprovalResolved = AgentEventBase & {
  type: "approval.resolved";
  runId: string;
  approvalId: string;
  approved: boolean;
};

export type AgentSessionEvent =
  | AgentRunStarted
  | AgentRunCompleted
  | AgentRunFailed
  | AgentRunCancelled
  | AgentUserMessage
  | AgentAssistantTextDelta
  | AgentAssistantReasoningDelta
  | AgentToolStarted
  | AgentToolCompleted
  | AgentToolFailed
  | AgentApprovalRequested
  | AgentApprovalResolved;

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
      kind: "text";
      text: string;
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
};

export type AgentSessionState = {
  sessionId: string | null;
  messages: AgentReducedMessage[];
  activeRunId: string | null;
  status: "idle" | "running" | "failed" | "cancelled";
  error: string | null;
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
    typeof value.type === "string"
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
    const index = blocks.findIndex((block) => block.kind === "reasoning");
    if (index < 0) {
      return [
        ...blocks,
        { kind: "reasoning" as const, text: event.delta, createdAt: event.createdAt },
      ];
    }
    return blocks.map((block, blockIndex) =>
      blockIndex === index && block.kind === "reasoning"
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

function upsertAssistantBlock(
  messages: AgentReducedMessage[],
  event: AgentAssistantReasoningDelta | AgentToolStarted | AgentToolCompleted | AgentToolFailed,
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

export function reduceAgentSession(events: AgentSessionEvent[]): AgentSessionState {
  return events.reduce<AgentSessionState>(
    (state, event) => {
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
        return {
          ...state,
          sessionId: event.sessionId,
          messages: [
            ...state.messages,
            {
              id: event.messageId,
              role: "user",
              text: event.text,
              createdAt: event.createdAt,
              contextRefs: event.contextRefs,
              files: event.files,
              composerContent: event.composerContent,
            },
          ],
        };
      }

      if (event.type === "assistant.text.delta") {
        return {
          ...state,
          sessionId: event.sessionId,
          messages: upsertAssistantText(state.messages, event),
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
    },
    {
      sessionId: null,
      messages: [],
      activeRunId: null,
      status: "idle",
      error: null,
    },
  );
}
