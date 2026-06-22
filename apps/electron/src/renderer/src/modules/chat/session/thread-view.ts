import type { RefObject } from "react";
import type { FileUIPart } from "ai";
import type { AgentChatMessage } from "@shared/chat";
import type { ComposerSendInput, EditingMessage } from "../composer/chat-composer";
import type { ApproveToolInput } from "../messages/agent-message-content";
import { messageText } from "../shared/text";

export type AgentThreadView = {
  visibleMessages: AgentChatMessage[];
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
    editMessage(message: AgentChatMessage): void;
    approveTool(input: ApproveToolInput): Promise<void>;
    cancelEdit(): void;
    stop(): void;
  };
};

export function editingMessageFromChatMessage(message: AgentChatMessage): EditingMessage {
  return {
    id: message.id,
    text: messageText(message),
    contextRefs: message.metadata?.contextRefs ?? [],
    files: message.parts.filter(
      (part): part is FileUIPart =>
        part.type === "file" && typeof part.url === "string" && typeof part.mediaType === "string",
    ),
    composerContent: message.metadata?.composerContent,
  };
}

function valueKey(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return String(value.length);
  return String(JSON.stringify(value)?.length ?? 0);
}

function partScrollKey(part: AgentChatMessage["parts"][number]) {
  const state = "state" in part && typeof part.state === "string" ? part.state : "";
  const text = "text" in part && typeof part.text === "string" ? part.text.length : "";
  const input = "input" in part ? valueKey(part.input) : "";
  const output = "output" in part ? valueKey(part.output) : "";
  const error = "errorText" in part ? valueKey(part.errorText) : "";
  return `${part.type}:${state}:${text}:${input}:${output}:${error}`;
}

export function scrollKeyFor(messages: AgentChatMessage[]) {
  const lastMessage = messages.at(-1);
  return lastMessage
    ? `${messages.length}:${lastMessage.id}:${lastMessage.parts.map(partScrollKey).join("|")}`
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
