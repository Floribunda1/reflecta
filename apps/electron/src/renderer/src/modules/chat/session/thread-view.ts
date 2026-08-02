import type { RefObject } from "react";
import type { ReactVirtualizer } from "@tanstack/react-virtual";
import type {
  AgentContextCompacted,
  AgentEntityCatalogEntry,
  AgentModelSelection,
  AgentReasoningLevel,
  AgentReducedMessage,
} from "@shared/agent";
import type { ComposerSendInput, EditingMessage } from "../adapters/chat-composer-adapter";
import type { ApproveToolInput } from "../adapters/chat-message-adapter";
import { findChatTextRanges } from "@reflecta/ui/chat";
import type { ChatTurnNavigationItem } from "./chat-turn-navigation";

export type AgentThreadView = {
  visibleMessages: AgentReducedMessage[];
  entityCatalog: AgentEntityCatalogEntry[];
  contextCompactions: AgentContextCompacted[];
  messagesFetching: boolean;
  messagesError?: Error;
  activeRunId: string | null;
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
  turnNavigationItems: ChatTurnNavigationItem[];
  activeTurnId: string | null;
  highlightedMessageId: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  messageVirtualizer: ReactVirtualizer<HTMLDivElement, HTMLDivElement>;
  handleScroll(): void;
  scrollToBottom(behavior?: ScrollBehavior): void;
  jumpToMessage(messageId: string): void;
  jumpToTurn(turnId: string): void;
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
    reloadMessages(): Promise<void>;
  };
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

export function activeAssistantMessageId(
  messages: AgentReducedMessage[],
  activeRunId: string | null,
) {
  if (!activeRunId) return undefined;
  return messages.findLast(
    (message) => message.role === "assistant" && message.runId === activeRunId,
  )?.id;
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
