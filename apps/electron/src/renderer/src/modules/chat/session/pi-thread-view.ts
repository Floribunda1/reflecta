import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { AgentSessionEvent, AgentSessionState } from "@shared/agent";
import {
  initialAgentSessionState,
  isAgentSessionEvent,
  reduceAgentSession,
  reduceAgentSessionEvent,
} from "@shared/agent";
import type { ComposerSendInput, EditingMessage } from "../composer/chat-composer";
import type { ApproveToolInput } from "../messages/agent-message-content";
import { chatUiStore, useStoppedMessageId, useThreadFocusNonce } from "./chat-ui-store";
import { chatQueryKeys } from "./query-keys";
import type { AgentThreadView } from "./thread-view";
import {
  buildChatJumpItems,
  editingMessageFromAgentMessage,
  scrollKeyFor,
  shouldShowScrollToBottomButton,
} from "./thread-view";

export function usePiAgentThreadView(sessionId: string, scrollRequest = 0): AgentThreadView {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AgentSessionState>(initialAgentSessionState);
  const [editingMessage, setEditingMessage] = useState<EditingMessage | undefined>();
  const focusRequest = useThreadFocusNonce(sessionId);
  const localStoppedMessageId = useStoppedMessageId(sessionId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottom = useRef(true);
  const eventIdsRef = useRef<Set<string>>(new Set());
  const pendingEventsRef = useRef<AgentSessionEvent[]>([]);
  const flushFrameRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastJumpMessageIdRef = useRef<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [activeJumpMessageId, setActiveJumpMessageId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const eventsQuery = useQuery({
    queryKey: chatQueryKeys.sessionEvents(sessionId),
    queryFn: () => ipcClient.chat.readSessionEvents(sessionId),
  });

  useEffect(() => {
    if (!eventsQuery.data) return;
    eventIdsRef.current = new Set(eventsQuery.data.map((event) => event.id));
    setState(reduceAgentSession(eventsQuery.data));
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
      if (!isAgentSessionEvent(payload) || payload.sessionId !== sessionId) return;
      if (eventIdsRef.current.has(payload.id)) return;
      eventIdsRef.current.add(payload.id);
      pendingEventsRef.current.push(payload);
      flushFrameRef.current ??= requestAnimationFrame(flushPendingEvents);
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
  const jumpItems = useMemo(() => buildChatJumpItems(visibleMessages), [visibleMessages]);
  lastJumpMessageIdRef.current = jumpItems.at(-1)?.messageId ?? null;
  const stoppedMessageId = useMemo(() => {
    if (localStoppedMessageId) return localStoppedMessageId;
    if (state.status !== "cancelled") return null;
    return (
      visibleMessages.findLast((message) => message.role === "assistant")?.id ??
      `${sessionId}:cancelled`
    );
  }, [localStoppedMessageId, sessionId, state.status, visibleMessages]);
  const isBusy = state.status === "running";
  const error = state.error ? new Error(state.error) : undefined;
  const scrollKey = `${scrollKeyFor(visibleMessages)}:${isBusy ? "busy" : "idle"}`;

  useEffect(() => {
    if (isBusy) chatUiStore.getState().setThreadRunning(sessionId, true);
    else chatUiStore.getState().setThreadRunning(sessionId, false);
  }, [isBusy, sessionId]);

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

  const updateActiveJumpMessage = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const rows = Array.from(
      element.querySelectorAll<HTMLElement>('[data-agent-message-id][data-message-role="user"]'),
    );
    const containerTop = element.getBoundingClientRect().top;
    const anchorTop = containerTop + Math.min(element.clientHeight * 0.35, 220);
    let candidateId: string | null = null;

    for (const row of rows) {
      const messageId = row.dataset.agentMessageId;
      if (!messageId) continue;
      const rect = row.getBoundingClientRect();
      if (rect.bottom < containerTop + 8) continue;
      if (rect.top <= anchorTop) {
        candidateId = messageId;
        continue;
      }
      candidateId ??= messageId;
      break;
    }

    setActiveJumpMessageId((current) => (current === candidateId ? current : candidateId));
  }, []);

  const jumpToMessage = useCallback((messageId: string) => {
    const element = scrollRef.current;
    if (!element) return;
    const row = Array.from(element.querySelectorAll<HTMLElement>("[data-agent-message-id]")).find(
      (candidate) => candidate.dataset.agentMessageId === messageId,
    );
    if (!row) return;

    row.scrollIntoView({ block: "start", behavior: "smooth" });
    shouldStickToBottom.current = false;
    setActiveJumpMessageId(messageId);
    setHighlightedMessageId(messageId);

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 1_400);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setActiveJumpMessageId((current) =>
      current && jumpItems.some((item) => item.messageId === current)
        ? current
        : (jumpItems.at(-1)?.messageId ?? null),
    );
  }, [jumpItems]);

  useEffect(() => {
    shouldStickToBottom.current = true;
    setScrollButtonVisible(false);
    const frame = requestAnimationFrame(() => {
      scrollToBottom("auto");
      setActiveJumpMessageId(lastJumpMessageIdRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollRequest, scrollToBottom, setScrollButtonVisible, sessionId]);

  useEffect(() => {
    if (!shouldStickToBottom.current) return;
    const frame = requestAnimationFrame(() => {
      scrollToBottom("auto");
      setActiveJumpMessageId(lastJumpMessageIdRef.current);
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
    updateActiveJumpMessage();
  }, [setScrollButtonVisible, updateActiveJumpMessage]);

  return {
    visibleMessages,
    messagesFetching: eventsQuery.isFetching,
    isBusy,
    composerBusy: isBusy,
    canStop: isBusy,
    error,
    editingMessage,
    stoppedMessageId,
    focusRequest,
    showScrollToBottom,
    jumpItems,
    activeJumpMessageId,
    highlightedMessageId,
    scrollRef: scrollRef as RefObject<HTMLDivElement | null>,
    handleScroll,
    scrollToBottom,
    jumpToMessage,
    actions: {
      send: async (input: ComposerSendInput) => {
        setEditingMessage(undefined);
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
      },
      retry: async () => {
        if (isBusy) return;
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
        if (isBusy) return;
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
        if (isBusy || message.role !== "user") return;
        setEditingMessage(editingMessageFromAgentMessage(message));
      },
      approveTool: async (input: ApproveToolInput) => {
        await ipcClient.chat.sendAgentCommand({
          type: input.approved ? "tool.approve" : "tool.reject",
          sessionId,
          approvalId: input.approvalId,
        });
      },
      cancelEdit: () => setEditingMessage(undefined),
      stop: () => {
        const lastAssistantId = visibleMessages.findLast(
          (message) => message.role === "assistant",
        )?.id;
        if (lastAssistantId) chatUiStore.getState().setStoppedMessage(sessionId, lastAssistantId);
        void ipcClient.chat.sendAgentCommand({ type: "run.cancel", sessionId });
      },
    },
  };
}
