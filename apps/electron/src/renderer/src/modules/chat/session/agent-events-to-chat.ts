import type { AgentChatMessage } from "@shared/chat";
import type { AgentSessionState } from "@shared/agent";

export function agentStateToChatMessages(state: AgentSessionState): AgentChatMessage[] {
  return state.messages.map(
    (message) =>
      ({
        id: message.id,
        role: message.role,
        createdAt: message.createdAt,
        parts: message.text ? [{ type: "text", text: message.text }] : [],
        metadata:
          message.contextRefs || message.composerContent
            ? {
                contextRefs: message.contextRefs,
                composerContent: message.composerContent,
              }
            : undefined,
      }) satisfies AgentChatMessage,
  );
}
