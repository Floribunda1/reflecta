import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ipcClient } from "@renderer/utils/ipc";
import type { AgentEvent, AgentSessionState } from "@shared/agent";
import {
  initialAgentSessionState,
  isAgentEvent,
  reduceAgentSession,
  reduceAgentSessionEvent,
} from "@shared/agent";
import type { ComposerSendInput, EditingMessage } from "../adapters/chat-composer-adapter";
import type { ApproveToolInput } from "../adapters/chat-message-adapter";
import { chatUiStore, useStoppedMessageId, useThreadFocusNonce } from "./chat-ui-store";
import { chatQueryKeys } from "./query-keys";
import { invalidateEntityDisplay } from "../../capture/queries";
import type { AgentThreadView } from "./thread-view";
import {
  editingMessageFromAgentMessage,
  mergeAgentEvents,
  scrollKeyFor,
  shouldShowScrollToBottomButton,
} from "./thread-view";
import { buildChatTurnNavigationItems } from "./chat-turn-navigation";

const CHAT_JUMP_BOTTOM_OFFSET = 24;
const CHAT_READING_LINE_RATIO = 0.75;
const CHAT_READING_LINE_BOTTOM_MARGIN = 96;

function completedEntityRef(event: AgentEvent) {
  if (event.type !== "tool.completed" || typeof event.output !== "object" || !event.output) {
    return null;
  }
  const output = event.output as Record<string, unknown>;
  const type = output.resultRefType;
  const id = output.resultRefId;
  if (
    (type !== "understanding" && type !== "context" && type !== "domain") ||
    typeof id !== "string"
  ) {
    return null;
  }
  return { type, id } as const;
}

export function usePiAgentThreadView(sessionId: string, scrollRequest = 0): AgentThreadView {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AgentSessionState>(initialAgentSessionState);
  const [editingMessage, setEditingMessage] = useState<EditingMessage | undefined>();
  const focusRequest = useThreadFocusNonce(sessionId);
  const localStoppedMessageId = useStoppedMessageId(sessionId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottom = useRef(true);
  const eventIdsRef = useRef<Set<string>>(new Set());
  const liveEventsRef = useRef<AgentEvent[]>([]);
  const pendingEventsRef = useRef<AgentEvent[]>([]);
  const flushFrameRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTurnIdRef = useRef<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [trackedTurnId, setTrackedTurnId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const eventsQuery = useQuery({
    queryKey: chatQueryKeys.sessionEvents(sessionId),
    queryFn: () => ipcClient.chat.readSessionEvents(sessionId),
  });

  useEffect(() => {
    setState(initialAgentSessionState);
    setEditingMessage(undefined);
    eventIdsRef.current.clear();
    liveEventsRef.current = [];
  }, [sessionId]);

  useEffect(() => {
    if (!eventsQuery.data) return;
    const events = mergeAgentEvents(eventsQuery.data, liveEventsRef.current);
    eventIdsRef.current = new Set(events.map((event) => event.id));
    setState(reduceAgentSession(events));
  }, [eventsQuery.data]);

  useEffect(() => {
    const flushPendingEvents = () => {
      flushFrameRef.current = null;
      const pending = pendingEventsRef.current;
      pendingEventsRef.current = [];
      if (pending.length === 0) return;
      setState((current) => pending.reduce(reduceAgentSessionEvent, current));
    };

    const listener = (_event: unknown, payload: unknown) => {
      if (!isAgentEvent(payload) || payload.sessionId !== sessionId) return;
      if (eventIdsRef.current.has(payload.id)) return;
      eventIdsRef.current.add(payload.id);
      liveEventsRef.current.push(payload);
      pendingEventsRef.current.push(payload);
      flushFrameRef.current ??= requestAnimationFrame(flushPendingEvents);
      const entityRef = completedEntityRef(payload);
      if (entityRef) void invalidateEntityDisplay(queryClient, entityRef);
      if (
        payload.type === "user.message" ||
        payload.type === "run.completed" ||
        payload.type === "run.failed" ||
        payload.type === "run.cancelled"
      ) {
        void queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads });
      }
    };
    window.ipcRenderer.on("agent:event", listener);
    return () => {
      window.ipcRenderer.removeListener("agent:event", listener);
      if (flushFrameRef.current !== null) cancelAnimationFrame(flushFrameRef.current);
      pendingEventsRef.current = [];
      flushFrameRef.current = null;
    };
  }, [queryClient, sessionId]);

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
    followOnAppend: true,
    scrollEndThreshold: 96,
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
    if (localStoppedMessageId) return localStoppedMessageId;
    if (state.status !== "cancelled") return null;
    return (
      visibleMessages.findLast((message) => message.role === "assistant")?.id ??
      `${sessionId}:cancelled`
    );
  }, [localStoppedMessageId, sessionId, state.status, visibleMessages]);
  const isBusy = state.status === "running";
  const isCompacting = Boolean(state.activeCompaction);
  const composerBusy = isBusy || isCompacting;
  const error = state.error ? new Error(state.error) : undefined;
  const compactionError = state.compactionError ? new Error(state.compactionError) : undefined;
  const scrollKey = `${scrollKeyFor(visibleMessages)}:${state.contextCompactions.length}:${composerBusy ? "busy" : "idle"}`;

  useEffect(() => {
    if (composerBusy) chatUiStore.getState().setThreadRunning(sessionId, true);
    else chatUiStore.getState().setThreadRunning(sessionId, false);
  }, [composerBusy, sessionId]);

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
    shouldStickToBottom.current = !shouldShowButton;
    setScrollButtonVisible(shouldShowButton);
    updateActiveTurn();
  }, [setScrollButtonVisible, updateActiveTurn]);

  return {
    visibleMessages,
    entityCatalog: state.entityCatalog,
    contextCompactions: state.contextCompactions,
    messagesFetching: eventsQuery.isFetching,
    messagesError: eventsQuery.error ?? undefined,
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
        chatUiStore.getState().setStoppedMessage(sessionId, null);
        await ipcClient.chat.sendAgentCommand({
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
        await ipcClient.chat.sendAgentCommand({
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
        chatUiStore.getState().setStoppedMessage(sessionId, null);
        await ipcClient.chat.sendAgentCommand({
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
        chatUiStore.getState().setStoppedMessage(sessionId, null);
        await ipcClient.chat.sendAgentCommand({
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
        const lastAssistantId = visibleMessages.findLast(
          (message) => message.role === "assistant",
        )?.id;
        if (lastAssistantId) chatUiStore.getState().setStoppedMessage(sessionId, lastAssistantId);
        void ipcClient.chat.sendAgentCommand({ type: "run.cancel", sessionId });
      },
      reloadMessages: async () => {
        await eventsQuery.refetch();
      },
    },
  };
}
