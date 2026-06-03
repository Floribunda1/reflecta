import type { AgentMessage, AgentToolCall } from "@earendil-works/pi-agent-core";
import type { AssistantMessageEvent, Message, TextContent } from "@earendil-works/pi-ai";
import type { SessionMessageEntry } from "@earendil-works/pi-coding-agent";
import type { ChatMessageDTO, ChatStreamEvent, ChatToolCallDTO } from "@shared/chat";

export const CHAT_STREAM_CHANNEL = "chat:stream-event";

export function mapAssistantEventToStreamEvent(
  event: AssistantMessageEvent,
): ChatStreamEvent | null {
  if (event.type === "text_delta") {
    return { type: "delta", content: event.delta };
  }
  return null;
}

export function agentMessageToDTO(message: AgentMessage, fallbackId: string): ChatMessageDTO {
  if (message.role === "user") {
    return {
      id: fallbackId,
      role: "user",
      content: extractText(message.content),
      createdAt: new Date(message.timestamp).toISOString(),
    };
  }

  if (message.role === "assistant") {
    const toolCalls = message.content
      .filter((part): part is AgentToolCall => part.type === "toolCall")
      .map(
        (part): ChatToolCallDTO => ({
          id: part.id,
          name: part.name,
          arguments: part.arguments,
        }),
      );

    const text = message.content
      .filter((part): part is TextContent => part.type === "text")
      .map((part) => part.text)
      .join("");

    return {
      id: fallbackId,
      role: "assistant",
      content: text,
      toolCalls: toolCalls.length > 0 ? toolCalls : null,
      createdAt: new Date(message.timestamp).toISOString(),
    };
  }

  if (message.role === "toolResult") {
    return {
      id: fallbackId,
      role: "tool",
      content: extractText(message.content),
      toolCallId: message.toolCallId,
      toolName: message.toolName,
      createdAt: new Date(message.timestamp).toISOString(),
    };
  }

  return {
    id: fallbackId,
    role: "assistant",
    content: "",
    createdAt: new Date().toISOString(),
  };
}

export function sessionEntriesToMessages(entries: SessionMessageEntry[]): ChatMessageDTO[] {
  return entries
    .filter((entry): entry is SessionMessageEntry => entry.type === "message")
    .map((entry, index) => agentMessageToDTO(entry.message, entry.id ?? `msg-${index}`));
}

function extractText(
  content: Message["content"] | (TextContent | { type: string; text?: string })[],
): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if ("text" in part && typeof part.text === "string") return part.text;
      return "";
    })
    .join("");
}

export function wrapStreamPayload(requestId: string, event: ChatStreamEvent) {
  return { requestId, event };
}
