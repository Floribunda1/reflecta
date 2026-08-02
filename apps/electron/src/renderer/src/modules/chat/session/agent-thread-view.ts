import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ipcClient } from "@renderer/utils/ipc";
import type { AgentCommand, AgentReducedMessage } from "@shared/agent";
import { initialAgentSessionState } from "@shared/agent";
import type { ComposerSendInput, EditingMessage } from "../adapters/chat-composer-adapter";
import type { ApproveToolInput } from "../adapters/chat-message-adapter";
import { useThreadFocusNonce } from "./chat-ui-store";
import { chatQueryKeys } from "./query-keys";
import { invalidateEntityDisplay } from "../../capture/queries";
import type { AgentThreadView } from "./thread-view";
import {
  editingMessageFromAgentMessage,
  scrollKeyFor,
  shouldShowScrollToBottomButton,
} from "./thread-view";
import { buildChatTurnNavigationItems } from "./chat-turn-navigation";
import { agentSessionReplica, useAgentSession } from "./agent-session-replica";

const CHAT_JUMP_BOTTOM_OFFSET = 24;
const CHAT_READING_LINE_RATIO = 0.75;
const CHAT_READING_LINE_BOTTOM_MARGIN = 96;
const CHAT_SCROLL_END_THRESHOLD = 1;

function completedEntityRef(output: unknown) {
  if (typeof output !== "object" || !output) return null;
  const record = output as Record<string, unknown>;
  const type = record.resultRefType;
  const id = record.resultRefId;
  if (
    (type !== "understanding" && type !== "context" && type !== "domain") ||
    typeof id !== "string"
  ) {
    return null;
  }
  return { type, id } as const;
}

function completedEntityRefs(messages: readonly AgentReducedMessage[]) {
  return messages.flatMap((message) =>
    (message.blocks ?? []).flatMap((block) => {
      if (block.kind === "tool" && block.state === "completed") {
        const ref = completedEntityRef(block.output);
        return ref ? [{ ...ref, key: `tool:${block.toolCallId}:${ref.type}:${ref.id}` }] : [];
      }
      if (block.kind === "approval" && block.executionState === "completed") {
        const ref = completedEntityRef(block.output);
        return ref ? [{ ...ref, key: `approval:${block.approvalId}:${ref.type}:${ref.id}` }] : [];
      }
      return [];
    }),
  );
}

async function sendRetainedAgentCommand(
  command: Extract<AgentCommand, { type: "message.send" | "context.compact" }>,
) {
  const release = agentSessionReplica.retainUntilSettled(command.sessionId);
  try {
    await ipcClient.chat.sendAgentCommand(command);
  } catch (error) {
    release();
    throw error;
  }
}

export function useAgentThreadView(sessionId: string, scrollRequest = 0): AgentThreadView {
  const queryClient = useQueryClient();
  const sessionRead = useAgentSession(sessionId);
  const state =
    sessionRead.status === "ready"
      ? sessionRead.session
      : { ...initialAgentSessionState, sessionId };
  const [editingMessage, setEditingMessage] = useState<EditingMessage | undefined>();
  const focusRequest = useThreadFocusNonce(sessionId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottom = useRef(true);
  const invalidatedEntityRefs = useRef<Set<string>>(new Set());
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTurnIdRef = useRef<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [trackedTurnId, setTrackedTurnId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  useEffect(() => {
    setEditingMessage(undefined);
    invalidatedEntityRefs.current.clear();
  }, [sessionId]);

  useEffect(() => {
    for (const ref of completedEntityRefs(state.messages)) {
      if (invalidatedEntityRefs.current.has(ref.key)) continue;
      invalidatedEntityRefs.current.add(ref.key);
      void invalidateEntityDisplay(queryClient, ref);
    }
  }, [queryClient, state.messages]);

  const threadSummaryKey = `${state.messages.filter((message) => message.role === "user").length}:${state.status}`;
  const previousThreadSummaryKey = useRef(threadSummaryKey);
  useEffect(() => {
    if (previousThreadSummaryKey.current === threadSummaryKey) return;
    previousThreadSummaryKey.current = threadSummaryKey;
    void queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
  }, [queryClient, threadSummaryKey]);

  const visibleMessages = state.messages;
  const visibleMessagesRef = useRef(visibleMessages);
  visibleMessagesRef.current = visibleMessages;
  const getVirtualMessageKey = useCallback(
    (index: number) => visibleMessagesRef.current[index]?.id ?? index,
    [],
  );
  const messageVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: visibleMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 240,
    getItemKey: getVirtualMessageKey,
    overscan: 5,
    gap: 20,
    anchorTo: "end",
    followOnAppend: false,
    // The hook owns end-following so user scrolling can cancel it immediately.
    scrollEndThreshold: -1,
    scrollPaddingEnd: CHAT_JUMP_BOTTOM_OFFSET,
    directDomUpdates: true,
  });
  const messageIndexById = useMemo(
    () => new Map(visibleMessages.map((message, index) => [message.id, index])),
    [visibleMessages],
  );
  const turnNavigationItems = useMemo(
    () => buildChatTurnNavigationItems(visibleMessages),
    [visibleMessages],
  );
  const lastTurnId = turnNavigationItems.at(-1)?.turnId ?? null;
  lastTurnIdRef.current = lastTurnId;
  const activeTurnId =
    trackedTurnId && turnNavigationItems.some((item) => item.turnId === trackedTurnId)
      ? trackedTurnId
      : lastTurnId;
  const stoppedMessageId = useMemo(() => {
    if (state.status !== "cancelled") return null;
    return (
      visibleMessages.findLast((message) => message.role === "assistant")?.id ??
      `${sessionId}:cancelled`
    );
  }, [sessionId, state.status, visibleMessages]);
  const isBusy = state.status === "running";
  const isCompacting = Boolean(state.activeCompaction);
  const composerBusy = isBusy || isCompacting;
  const error = state.error ? new Error(state.error) : undefined;
  const compactionError = state.compactionError ? new Error(state.compactionError) : undefined;
  const scrollKey = `${scrollKeyFor(visibleMessages)}:${state.contextCompactions.length}:${composerBusy ? "busy" : "idle"}`;

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

  const updateActiveTurn = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const virtualItems = messageVirtualizer.getVirtualItems();
    const firstItem = virtualItems[0];
    if (!firstItem) return;
    const readingOffset =
      element.scrollTop +
      Math.max(
        element.clientHeight * CHAT_READING_LINE_RATIO,
        element.clientHeight - CHAT_READING_LINE_BOTTOM_MARGIN,
      );
    let activeMessageIndex = firstItem.index;
    for (const item of virtualItems) {
      if (item.start > readingOffset) break;
      activeMessageIndex = item.index;
    }
    let resolvedTurnId: string | null = null;
    for (let index = activeMessageIndex; index >= 0; index -= 1) {
      const message = visibleMessages[index];
      if (message?.role !== "user") continue;
      resolvedTurnId = message.id;
      break;
    }

    setTrackedTurnId((current) => (current === resolvedTurnId ? current : resolvedTurnId));
  }, [messageVirtualizer, visibleMessages]);

  const jumpToMessage = useCallback(
    (messageId: string) => {
      const index = messageIndexById.get(messageId);
      if (index === undefined) return;
      messageVirtualizer.scrollToIndex(index, { align: "center", behavior: "auto" });
      shouldStickToBottom.current = false;
    },
    [messageIndexById, messageVirtualizer],
  );

  const jumpToTurn = useCallback(
    (turnId: string) => {
      const index = messageIndexById.get(turnId);
      if (index === undefined) return;
      messageVirtualizer.scrollToIndex(index, { align: "end", behavior: "auto" });
      shouldStickToBottom.current = false;
      setTrackedTurnId(turnId);
      setHighlightedMessageId(turnId);

      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 1_400);
    },
    [messageIndexById, messageVirtualizer],
  );

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    shouldStickToBottom.current = true;
    setScrollButtonVisible(false);
    const frame = requestAnimationFrame(() => {
      scrollToBottom("auto");
      setTrackedTurnId(lastTurnIdRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollRequest, scrollToBottom, setScrollButtonVisible, sessionId]);

  useEffect(() => {
    if (!shouldStickToBottom.current) return;
    const frame = requestAnimationFrame(() => {
      if (!shouldStickToBottom.current) return;
      scrollToBottom("auto");
      setTrackedTurnId(lastTurnIdRef.current);
    });
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
    shouldStickToBottom.current &&=
      element.scrollHeight - element.scrollTop - element.clientHeight <= CHAT_SCROLL_END_THRESHOLD;
    setScrollButtonVisible(shouldShowButton);
    updateActiveTurn();
  }, [setScrollButtonVisible, updateActiveTurn]);

  return {
    visibleMessages,
    entityCatalog: state.entityCatalog,
    contextCompactions: state.contextCompactions,
    messagesFetching: sessionRead.status === "loading",
    messagesError:
      sessionRead.status === "unavailable" ? new Error(sessionRead.error.message) : undefined,
    activeRunId: state.activeRunId,
    isBusy,
    isCompacting,
    composerBusy,
    canStop: isBusy,
    error,
    compactionError,
    editingMessage,
    stoppedMessageId,
    focusRequest,
    showScrollToBottom,
    turnNavigationItems,
    activeTurnId,
    highlightedMessageId,
    scrollRef: scrollRef as RefObject<HTMLDivElement | null>,
    messageVirtualizer,
    handleScroll,
    scrollToBottom,
    jumpToMessage,
    jumpToTurn,
    actions: {
      send: async (input: ComposerSendInput) => {
        shouldStickToBottom.current = true;
        setScrollButtonVisible(false);
        await sendRetainedAgentCommand({
          type: "message.send",
          sessionId,
          text: input.text,
          messageId: input.messageId,
          contextRefs: input.contextRefs,
          files: input.files,
          composerContent: input.composerContent,
          modelSelection: input.modelSelection,
          reasoningLevel: input.reasoningLevel,
        });
        setEditingMessage(undefined);
      },
      compact: async (modelSelection, reasoningLevel) => {
        if (composerBusy || visibleMessages.length === 0) return;
        shouldStickToBottom.current = true;
        setScrollButtonVisible(false);
        await sendRetainedAgentCommand({
          type: "context.compact",
          sessionId,
          modelSelection,
          reasoningLevel,
        });
      },
      retry: async () => {
        if (composerBusy) return;
        const userMessage = visibleMessages.findLast((message) => message.role === "user");
        if (!userMessage) return;
        await sendRetainedAgentCommand({
          type: "message.send",
          sessionId,
          text: userMessage.text,
          messageId: userMessage.id,
          contextRefs: userMessage.contextRefs,
          files: userMessage.files,
          composerContent: userMessage.composerContent,
        });
      },
      regenerate: async (messageId) => {
        if (composerBusy) return;
        const assistantIndex = visibleMessages.findIndex((message) => message.id === messageId);
        const userMessage =
          assistantIndex >= 0
            ? visibleMessages
                .slice(0, assistantIndex)
                .findLast((message) => message.role === "user")
            : undefined;
        if (!userMessage) return;
        await sendRetainedAgentCommand({
          type: "message.send",
          sessionId,
          text: userMessage.text,
          messageId: userMessage.id,
          contextRefs: userMessage.contextRefs,
          files: userMessage.files,
          composerContent: userMessage.composerContent,
        });
      },
      editMessage: (message) => {
        if (composerBusy || message.role !== "user") return;
        setEditingMessage(editingMessageFromAgentMessage(message));
      },
      approveTool: async (input: ApproveToolInput) => {
        await ipcClient.chat.sendAgentCommand(
          input.approved
            ? {
                type: "tool.approve",
                sessionId,
                approvalId: input.approvalId,
              }
            : {
                type: "tool.reject",
                sessionId,
                approvalId: input.approvalId,
                ...(input.rejectionReason ? { reason: input.rejectionReason } : {}),
              },
        );
      },
      cancelEdit: () => setEditingMessage(undefined),
      stop: () => {
        void ipcClient.chat.sendAgentCommand({ type: "run.cancel", sessionId });
      },
      reloadMessages: async () => {
        agentSessionReplica.reconnect(sessionId);
      },
    },
  };
}
