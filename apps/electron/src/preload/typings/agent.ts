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
  toolCallId: string;
  toolName: string;
  input?: unknown;
};

export type AgentToolCompleted = AgentEventBase & {
  type: "tool.completed";
  runId: string;
  toolCallId: string;
  output?: unknown;
};

export type AgentToolFailed = AgentEventBase & {
  type: "tool.failed";
  runId: string;
  toolCallId: string;
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

function upsertAssistantMessage(
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
        createdAt: event.createdAt,
      },
    ];
  }

  return messages.map((message, messageIndex) =>
    messageIndex === index ? { ...message, text: message.text + event.delta } : message,
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
          messages: upsertAssistantMessage(state.messages, event),
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
