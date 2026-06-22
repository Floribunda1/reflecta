import type { FileUIPart } from "ai";
import type { AgentChatMessage } from "@shared/chat";
import type { AgentSessionState } from "@shared/agent";

export function agentStateToChatMessages(state: AgentSessionState): AgentChatMessage[] {
  return state.messages.map((message) => {
    const parts: AgentChatMessage["parts"] = [
      ...(message.text ? [{ type: "text" as const, text: message.text }] : []),
      ...(message.files ?? []).map((file) => ({
        type: "file" as const,
        mediaType: file.mediaType,
        filename: file.filename,
        url: file.url,
        providerMetadata: file.providerMetadata as FileUIPart["providerMetadata"],
      })),
    ];
    return {
      id: message.id,
      role: message.role,
      createdAt: message.createdAt,
      parts,
      metadata:
        message.contextRefs || message.composerContent
          ? {
              contextRefs: message.contextRefs,
              composerContent: message.composerContent,
            }
          : undefined,
    } satisfies AgentChatMessage;
  });
}
