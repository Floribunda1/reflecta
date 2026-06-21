import type { UIMessage, UIMessageChunk } from "ai";

export type AgentContextRef = {
  type: "thought" | "context" | "category";
  id: string;
  title?: string;
};

export type AgentMessageMetadata = {
  contextRefs?: AgentContextRef[];
  composerContent?: AgentComposerContentNode;
};

export type AgentComposerContentNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AgentComposerContentNode[];
};

export type AgentChatMessage = UIMessage<AgentMessageMetadata> & {
  createdAt?: string;
};

export type AgentThreadDTO = {
  id: string;
  title: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type AgentModelSelection = {
  providerId: string;
  modelId: string;
};

export type AgentReasoningLevel = "default" | "low" | "medium" | "high" | "xhigh";

export type AgentProposalType =
  | "thought_create"
  | "thought_update"
  | "thought_delete"
  | "category_create"
  | "category_update"
  | "category_delete"
  | "context_create"
  | "context_update"
  | "context_delete"
  | "bash";

export type SendAgentMessageInput = {
  requestId: string;
  threadId: string;
  messages: AgentChatMessage[];
  modelSelection?: AgentModelSelection;
  reasoningLevel?: AgentReasoningLevel;
};

export type SendAgentMessageResult = {
  requestId: string;
};

export type CancelAgentRunInput = {
  requestId: string;
};

export type AgentStreamPayload = {
  requestId: string;
  chunk: UIMessageChunk;
};

export type AgentMessagesResult = AgentChatMessage[];
