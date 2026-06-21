import type { AgentChatMessage } from "@shared/chat";
import { agentMessageDisplayText } from "@shared/chat-display";

export function messageText(message: AgentChatMessage) {
  return agentMessageDisplayText(message);
}

export function truncate(value: string, max = 280) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
