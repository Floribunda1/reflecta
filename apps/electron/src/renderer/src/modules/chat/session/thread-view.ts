import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import type { FileUIPart } from "ai";
import type { AgentChatMessage } from "@shared/chat";
import type { ComposerSendInput, EditingMessage } from "../composer/chat-composer";
import type { ApproveToolInput } from "../messages/agent-message-content";
import { messageText } from "../shared/text";
import { useThreadMessagesQuery } from "./server-state";
import { chatUiStore, useStoppedMessageId, useThreadFocusNonce } from "./chat-ui-store";
import { getAgentThreadChat } from "./chat-registry";

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

function messagesEqualByShape(left: AgentChatMessage[], right: AgentChatMessage[]) {
  if (left.length !== right.length) return false;
  return left.every((message, index) => {
    const other = right[index];
    return (
      other &&
      message.id === other.id &&
      message.role === other.role &&
      message.parts.length === other.parts.length &&
      message.createdAt === other.createdAt &&
      messageText(message) === messageText(other)
    );
  });
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

export function useAgentThreadView(threadId: string, scrollRequest = 0): AgentThreadView {
  const queryClient = useQueryClient();
  const messagesQuery = useThreadMessagesQuery(threadId);
  const persistedMessages = messagesQuery.data ?? [];
  const [editingMessage, setEditingMessage] = useState<EditingMessage | undefined>();
  const focusRequest = useThreadFocusNonce(threadId);
  const stoppedMessageId = useStoppedMessageId(threadId);
  const chatInstance = useMemo(
    () => getAgentThreadChat({ threadId, messages: persistedMessages, queryClient }),
    [persistedMessages, queryClient, threadId],
  );
  const chat = useChat<AgentChatMessage>({
    chat: chatInstance,
    experimental_throttle: 80,
  });
  const isBusy = chat.status === "submitted" || chat.status === "streaming";
  const visibleMessages = chat.messages;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottom = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollKey = scrollKeyFor(visibleMessages);

  useEffect(() => {
    if (isBusy) chatUiStore.getState().setThreadRunning(threadId, true);
    if (!isBusy && chat.status !== "error")
      chatUiStore.getState().setThreadRunning(threadId, false);
  }, [chat.status, isBusy, threadId]);

  useEffect(() => {
    if (chat.status !== "ready") return;
    if (persistedMessages.length === 0 && chat.messages.length > 0) return;
    if (messagesEqualByShape(chat.messages, persistedMessages)) return;
    chat.setMessages(persistedMessages);
  }, [chat, persistedMessages]);

  const setScrollButtonVisible = useCallback((visible: boolean) => {
    setShowScrollToBottom((current) => (current === visible ? current : visible));
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const element = scrollRef.current;
      if (!element) return;
      element.scrollTo({ top: element.scrollHeight, behavior });
      shouldStickToBottom.current = true;
      setScrollButtonVisible(false);
    },
    [setScrollButtonVisible],
  );

  useEffect(() => {
    shouldStickToBottom.current = true;
    setScrollButtonVisible(false);
    const frame = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(frame);
  }, [scrollRequest, scrollToBottom, setScrollButtonVisible, threadId]);

  useEffect(() => {
    if (!shouldStickToBottom.current) return;
    const frame = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(frame);
  }, [scrollKey, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const shouldShowButton = shouldShowScrollToBottomButton({
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
    });
    shouldStickToBottom.current = !shouldShowButton;
    setScrollButtonVisible(shouldShowButton);
  }, [setScrollButtonVisible]);

  return {
    visibleMessages,
    messagesFetching: messagesQuery.isFetching,
    isBusy,
    composerBusy: isBusy,
    canStop: isBusy,
    error: chat.error,
    editingMessage,
    stoppedMessageId,
    focusRequest,
    showScrollToBottom,
    scrollRef,
    handleScroll,
    scrollToBottom,
    actions: {
      send: async (input) => {
        setEditingMessage(undefined);
        chatUiStore.getState().setStoppedMessage(threadId, null);
        const metadata = {
          contextRefs: input.contextRefs,
          composerContent: input.composerContent,
        };
        const message =
          input.text.length > 0
            ? {
                text: input.text,
                files: input.files.length > 0 ? input.files : undefined,
                messageId: input.messageId,
                metadata,
              }
            : {
                files: input.files,
                messageId: input.messageId,
                metadata,
              };
        await chat.sendMessage(message, {
          body: {
            modelSelection: input.modelSelection,
            reasoningLevel: input.reasoningLevel,
          },
        });
      },
      retry: async () => {
        chatUiStore.getState().setStoppedMessage(threadId, null);
        await chat.regenerate();
      },
      regenerate: async (messageId) => {
        chatUiStore.getState().setStoppedMessage(threadId, null);
        await chat.regenerate({ messageId });
      },
      editMessage: (message) => {
        if (isBusy || message.role !== "user") return;
        setEditingMessage(editingMessageFromChatMessage(message));
      },
      approveTool: async (input) => {
        await chat.addToolApprovalResponse({
          id: input.approvalId,
          approved: input.approved,
          options: {
            body: {
              modelSelection: input.modelSelection,
              reasoningLevel: input.reasoningLevel,
            },
          },
        });
      },
      cancelEdit: () => setEditingMessage(undefined),
      stop: () => {
        const lastAssistantId = chat.messages.findLast(
          (message) => message.role === "assistant",
        )?.id;
        if (lastAssistantId) chatUiStore.getState().setStoppedMessage(threadId, lastAssistantId);
        void chat.stop();
      },
    },
  };
}
