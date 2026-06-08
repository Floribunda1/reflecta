import type { ChatMessageDTO } from "@shared/chat";
import type { UIMessage } from "ai";

function tryParseToolOutput(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

export function dtoListToUiMessages(dtos: ChatMessageDTO[]): UIMessage[] {
  const result: UIMessage[] = [];
  const pendingToolParts = new Map<string, { messageIndex: number; partIndex: number }>();

  for (const dto of dtos) {
    if (dto.role === "user") {
      result.push({
        id: dto.id,
        role: "user",
        parts: [{ type: "text", text: dto.content, state: "done" }],
      });
      continue;
    }

    if (dto.role === "assistant") {
      const parts: UIMessage["parts"] = [];
      if (dto.content) {
        parts.push({ type: "text", text: dto.content, state: "done" });
      }
      for (const toolCall of dto.toolCalls ?? []) {
        parts.push({
          type: "dynamic-tool",
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          state: "input-available",
          input: toolCall.arguments,
        });
        pendingToolParts.set(toolCall.id, {
          messageIndex: result.length,
          partIndex: parts.length - 1,
        });
      }
      result.push({ id: dto.id, role: "assistant", parts });
      continue;
    }

    if (dto.role === "tool" && dto.toolCallId) {
      const location = pendingToolParts.get(dto.toolCallId);
      if (!location) continue;

      const message = result[location.messageIndex];
      const part = message?.parts[location.partIndex];
      if (!message || part?.type !== "dynamic-tool") continue;

      message.parts[location.partIndex] = {
        type: "dynamic-tool",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input,
        state: "output-available",
        output: tryParseToolOutput(dto.content),
      };
    }
  }

  return result;
}
