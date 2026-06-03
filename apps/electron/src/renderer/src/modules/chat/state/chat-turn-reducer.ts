import type { ChatStreamEvent } from "@shared/chat";
import type { ActiveTurnState, ThreadItem, ToolCallState, TurnStatus } from "./types";

function deriveStatus(toolCalls: Record<string, ToolCallState>): TurnStatus {
  const values = Object.values(toolCalls);
  if (values.some((tool) => tool.status === "pending")) return "waiting_tool";
  if (values.some((tool) => tool.status === "running")) return "streaming";
  return "streaming";
}

export function createInitialTurnState(
  conversationId: string,
  optimisticUserMessage: ActiveTurnState["optimisticUserMessage"],
): ActiveTurnState {
  return {
    requestId: null,
    conversationId,
    status: "sending",
    optimisticUserMessage,
    assistantDraft: { id: `draft-${Date.now()}`, content: "" },
    toolCalls: {},
    errorMessage: null,
  };
}

export function reduceTurnState(state: ActiveTurnState, event: ChatStreamEvent): ActiveTurnState {
  switch (event.type) {
    case "delta": {
      const draft = state.assistantDraft ?? { id: `draft-${Date.now()}`, content: "" };
      return {
        ...state,
        status: deriveStatus(state.toolCalls),
        assistantDraft: {
          ...draft,
          content: draft.content + event.content,
        },
      };
    }
    case "tool_pending": {
      const toolCalls = {
        ...state.toolCalls,
        [event.toolCallId]: {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          input: event.input,
          status: "pending" as const,
        },
      };
      return {
        ...state,
        status: "waiting_tool",
        toolCalls,
      };
    }
    case "tool_running": {
      const existing = state.toolCalls[event.toolCallId];
      if (!existing) return state;
      const updated = { ...existing, status: "running" as const };
      return {
        ...state,
        status: deriveStatus({ ...state.toolCalls, [event.toolCallId]: updated }),
        toolCalls: { ...state.toolCalls, [event.toolCallId]: updated },
      };
    }
    case "tool_result": {
      const existing = state.toolCalls[event.toolCallId];
      if (!existing) return state;
      const updated = {
        ...existing,
        result: event.result,
        status: event.isError ? ("error" as const) : ("done" as const),
        isError: event.isError,
      };
      const toolCalls = { ...state.toolCalls, [event.toolCallId]: updated };
      return {
        ...state,
        status: deriveStatus(toolCalls),
        toolCalls,
      };
    }
    case "done":
      return { ...state, status: "done" };
    case "error":
      return { ...state, status: "error", errorMessage: event.message };
    case "cancelled":
      return { ...state, status: "cancelled" };
    default:
      return state;
  }
}

export function buildThreadItems(
  history: import("@shared/chat").ChatMessageDTO[],
  turn: ActiveTurnState | null,
): ThreadItem[] {
  const items: ThreadItem[] = history.map((message) => ({ kind: "message", message }));

  if (!turn) return items;

  items.push({ kind: "message", message: turn.optimisticUserMessage });

  for (const tool of Object.values(turn.toolCalls)) {
    items.push({ kind: "tool", tool });
  }

  if (turn.assistantDraft && (turn.assistantDraft.content || turn.status !== "done")) {
    items.push({
      kind: "assistant-draft",
      id: turn.assistantDraft.id,
      content: turn.assistantDraft.content,
      streaming:
        turn.status === "streaming" || turn.status === "waiting_tool" || turn.status === "sending",
    });
  }

  if (turn.status === "error" && turn.errorMessage) {
    items.push({
      kind: "message",
      message: {
        id: `error-${turn.requestId ?? "local"}`,
        role: "assistant",
        content: turn.errorMessage,
        createdAt: new Date().toISOString(),
      },
    });
  }

  return items;
}
