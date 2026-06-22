import type { FileUIPart } from "ai";
import type { AgentChatMessage } from "@shared/chat";
import type {
  AgentReducedAssistantBlock,
  AgentReducedMessage,
  AgentSessionState,
} from "@shared/agent";

export function agentStateToChatMessages(state: AgentSessionState): AgentChatMessage[] {
  return state.messages.map((message) => {
    const parts = partsForMessage(message, state);
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

function partsForMessage(
  message: AgentReducedMessage,
  state: AgentSessionState,
): AgentChatMessage["parts"] {
  const fileParts = (message.files ?? []).map((file) => ({
    type: "file" as const,
    mediaType: file.mediaType,
    filename: file.filename,
    url: file.url,
    providerMetadata: file.providerMetadata as FileUIPart["providerMetadata"],
  }));
  if (message.role === "assistant" && message.blocks?.length) {
    return message.blocks.flatMap((block) => assistantBlockParts(block, message, state));
  }
  return [...(message.text ? [{ type: "text" as const, text: message.text }] : []), ...fileParts];
}

function assistantBlockParts(
  block: AgentReducedAssistantBlock,
  message: AgentReducedMessage,
  state: AgentSessionState,
): AgentChatMessage["parts"] {
  if (block.kind === "text") return block.text ? [{ type: "text", text: block.text }] : [];
  if (block.kind === "reasoning") {
    return block.text
      ? [
          {
            type: "reasoning",
            text: block.text,
            state:
              state.status === "running" && message.runId === state.activeRunId
                ? "streaming"
                : "done",
          },
        ]
      : [];
  }
  if (block.state === "failed") {
    return [
      {
        type: `tool-${block.toolName}`,
        toolCallId: block.toolCallId,
        state: "output-error",
        input: block.input ?? {},
        errorText: block.error ?? "Tool failed",
      } as AgentChatMessage["parts"][number],
    ];
  }
  if (block.state === "completed") {
    return [
      {
        type: `tool-${block.toolName}`,
        toolCallId: block.toolCallId,
        state: "output-available",
        input: block.input ?? {},
        output: block.output,
      } as AgentChatMessage["parts"][number],
    ];
  }
  return [
    {
      type: `tool-${block.toolName}`,
      toolCallId: block.toolCallId,
      state: "input-available",
      input: block.input ?? {},
    } as AgentChatMessage["parts"][number],
  ];
}
