import type { RefObject } from "react";
import type {
  AgentContextCompacted,
  AgentEntityCatalogEntry,
  AgentModelSelection,
  AgentReasoningLevel,
  AgentReducedMessage,
} from "@shared/agent";
import type { ComposerSendInput, EditingMessage } from "../composer/chat-composer";
import type { ApproveToolInput } from "../messages/agent-message-content";
import { findChatTextRanges } from "./chat-find";

export type AgentThreadView = {
  visibleMessages: AgentReducedMessage[];
  entityCatalog: AgentEntityCatalogEntry[];
  contextCompactions: AgentContextCompacted[];
  messagesFetching: boolean;
  isBusy: boolean;
  isCompacting: boolean;
  composerBusy: boolean;
  canStop: boolean;
  error?: Error;
  compactionError?: Error;
  editingMessage?: EditingMessage;
  stoppedMessageId: string | null;
  focusRequest: number;
  showScrollToBottom: boolean;
  jumpItems: ChatJumpItem[];
  activeJumpMessageId: string | null;
  highlightedMessageId: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  handleScroll(): void;
  scrollToBottom(behavior?: ScrollBehavior): void;
  jumpToMessage(messageId: string): void;
  actions: {
    send(input: ComposerSendInput): Promise<void>;
    compact(
      modelSelection?: AgentModelSelection,
      reasoningLevel?: AgentReasoningLevel,
    ): Promise<void>;
    retry(): Promise<void>;
    regenerate(messageId: string): Promise<void>;
    editMessage(message: AgentReducedMessage): void;
    approveTool(input: ApproveToolInput): Promise<void>;
    cancelEdit(): void;
    stop(): void;
  };
};

export type ChatJumpItem = {
  messageId: string;
  label: string;
  role: AgentReducedMessage["role"];
};

export type ChatFindMatch = {
  messageId: string;
  matchIndex: number;
  role: AgentReducedMessage["role"];
};

export function editingMessageFromAgentMessage(message: AgentReducedMessage): EditingMessage {
  return {
    id: message.id,
    text: message.text,
    contextRefs: message.contextRefs ?? [],
    files: message.files ?? [],
    composerContent: message.composerContent,
  };
}

function normalizedSnippet(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function fallbackMessageLabel(message: AgentReducedMessage) {
  const fileNames = message.files
    ?.map((file) => file.filename || file.mediaType)
    .filter(Boolean)
    .join("、");
  if (fileNames) return `附件：${fileNames}`;

  const actionBlock = message.blocks?.find(
    (block) => block.kind === "tool" || block.kind === "approval",
  );
  if (!actionBlock) return message.role === "user" ? "用户消息" : "Agent 回复";
  if (actionBlock.kind === "approval") return actionBlock.title;
  return `工具：${actionBlock.toolName}`;
}

export function chatJumpLabelFor(message: AgentReducedMessage) {
  return normalizedSnippet(message.text) || fallbackMessageLabel(message);
}

export function buildChatJumpItems(messages: AgentReducedMessage[]): ChatJumpItem[] {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => ({
      messageId: message.id,
      label: chatJumpLabelFor(message),
      role: message.role,
    }));
}

export function buildChatFindMatches(
  messages: AgentReducedMessage[],
  query: string,
): ChatFindMatch[] {
  return messages.flatMap((message) =>
    findChatTextRanges(message.text, query).map((_, matchIndex) => ({
      messageId: message.id,
      matchIndex,
      role: message.role,
    })),
  );
}

export function shouldShowPendingAssistantPlaceholder(
  messages: AgentReducedMessage[],
  isBusy: boolean,
) {
  return isBusy && messages.at(-1)?.role !== "assistant";
}

function valueKey(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return String(value.length);
  return String(JSON.stringify(value)?.length ?? 0);
}

function blockScrollKey(block: NonNullable<AgentReducedMessage["blocks"]>[number]) {
  if (block.kind === "text" || block.kind === "reasoning") {
    return `${block.kind}:${block.text.length}`;
  }
  if (block.kind === "tool") {
    return `${block.kind}:${block.toolCallId}:${block.state}:${valueKey(block.input)}:${valueKey(block.output)}:${valueKey(block.error)}`;
  }
  if (block.kind === "context-compaction") {
    return `${block.kind}:${block.compaction.id}`;
  }
  return `${block.kind}:${block.approvalId}:${block.state}:${valueKey(block.payload)}:${valueKey(block.output)}:${valueKey(block.error)}`;
}

export function scrollKeyFor(messages: AgentReducedMessage[]) {
  const lastMessage = messages.at(-1);
  return lastMessage
    ? `${messages.length}:${lastMessage.id}:${lastMessage.text.length}:${(lastMessage.blocks ?? []).map(blockScrollKey).join("|")}`
    : "empty";
}

const SCROLL_BOTTOM_THRESHOLD = 96;

export function scrollTopForChildBottom({
  scrollTop,
  containerBottom,
  childBottom,
  bottomOffset = 0,
}: {
  scrollTop: number;
  containerBottom: number;
  childBottom: number;
  bottomOffset?: number;
}) {
  return Math.max(0, scrollTop + childBottom - containerBottom + bottomOffset);
}

export function shouldShowScrollToBottomButton({
  scrollHeight,
  scrollTop,
  clientHeight,
}: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}) {
  return scrollHeight - scrollTop - clientHeight > SCROLL_BOTTOM_THRESHOLD;
}
