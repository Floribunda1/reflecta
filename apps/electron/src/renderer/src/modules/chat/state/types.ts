import type { ChatMessageDTO } from "@shared/chat";

export type TurnStatus =
  | "idle"
  | "sending"
  | "streaming"
  | "waiting_tool"
  | "error"
  | "cancelled"
  | "done";

export type ToolCallState = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  result?: unknown;
  status: "pending" | "running" | "done" | "error";
  isError?: boolean;
};

export type ActiveTurnState = {
  requestId: string | null;
  conversationId: string;
  status: TurnStatus;
  optimisticUserMessage: ChatMessageDTO;
  assistantDraft: {
    id: string;
    content: string;
  } | null;
  toolCalls: Record<string, ToolCallState>;
  errorMessage: string | null;
};

export type KnowledgePanelMode = "browse" | "search" | "references" | "graph";

export type ThreadItem =
  | { kind: "message"; message: ChatMessageDTO }
  | { kind: "assistant-draft"; id: string; content: string; streaming: boolean }
  | { kind: "tool"; tool: ToolCallState };
