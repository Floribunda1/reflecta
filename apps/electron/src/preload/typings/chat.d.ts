export type ConversationDTO = {
  id: string;
  title: string;
  piSessionId: string | null;
  piSessionFile: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRole = "user" | "assistant" | "tool";

export type ChatMessageDTO = {
  id: string;
  role: ChatMessageRole;
  content: string;
  toolCalls?: ChatToolCallDTO[] | null;
  toolCallId?: string | null;
  toolName?: string | null;
  createdAt: string;
};

export type ChatToolCallDTO = {
  id: string;
  name: string;
  arguments: unknown;
};

export type ChatStreamEvent =
  | { type: "delta"; content: string }
  | {
      type: "tool_pending";
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | { type: "tool_running"; toolCallId: string; toolName: string }
  | {
      type: "tool_result";
      toolCallId: string;
      toolName: string;
      result: unknown;
      isError?: boolean;
    }
  | { type: "done"; conversationId: string }
  | { type: "error"; message: string }
  | { type: "cancelled" };

export type SendMessageInput = {
  conversationId: string;
  content: string;
  referenceThoughtIds?: string[];
};

export type ConfirmToolCallInput = {
  requestId: string;
  toolCallId: string;
  approved: boolean;
};

export type CancelStreamInput = {
  requestId: string;
};

export type SendMessageResult = {
  requestId: string;
};
