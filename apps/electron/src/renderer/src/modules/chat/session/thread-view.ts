import type { RefObject } from "react";
import type { AgentReducedMessage } from "@shared/agent";
import type { ComposerSendInput, EditingMessage } from "../composer/chat-composer";
import type { ApproveToolInput } from "../messages/agent-message-content";

export type AgentThreadView = {
  visibleMessages: AgentReducedMessage[];
  messagesFetching: boolean;
  isBusy: boolean;
  composerBusy: boolean;
  canStop: boolean;
  error?: Error;
  editingMessage?: EditingMessage;
  stoppedMessageId: string | null;
  focusRequest: number;
  showScrollToBottom: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  handleScroll(): void;
  scrollToBottom(): void;
  actions: {
    send(input: ComposerSendInput): Promise<void>;
    retry(): Promise<void>;
    regenerate(messageId: string): Promise<void>;
    editMessage(message: AgentReducedMessage): void;
    approveTool(input: ApproveToolInput): Promise<void>;
    cancelEdit(): void;
    stop(): void;
  };
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
  return `${block.kind}:${block.approvalId}:${block.state}:${valueKey(block.payload)}:${valueKey(block.output)}:${valueKey(block.error)}`;
}

export function scrollKeyFor(messages: AgentReducedMessage[]) {
  const lastMessage = messages.at(-1);
  return lastMessage
    ? `${messages.length}:${lastMessage.id}:${lastMessage.text.length}:${(lastMessage.blocks ?? []).map(blockScrollKey).join("|")}`
    : "empty";
}

const SCROLL_BOTTOM_THRESHOLD = 96;

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
