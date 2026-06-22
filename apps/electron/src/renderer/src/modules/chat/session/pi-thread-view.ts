import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { AgentSessionEvent } from "@shared/agent";
import { isAgentSessionEvent, reduceAgentSession } from "@shared/agent";
import type { ComposerSendInput, EditingMessage } from "../composer/chat-composer";
import type { ApproveToolInput } from "../messages/agent-message-content";
import { agentStateToChatMessages } from "./agent-events-to-chat";
import { chatUiStore, useStoppedMessageId, useThreadFocusNonce } from "./chat-ui-store";
import { chatQueryKeys } from "./query-keys";
import type { AgentThreadView } from "./thread-view";
import {
  editingMessageFromChatMessage,
  scrollKeyFor,
  shouldShowScrollToBottomButton,
} from "./thread-view";

export function usePiAgentThreadView(sessionId: string, scrollRequest = 0): AgentThreadView {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<AgentSessionEvent[]>([]);
  const [editingMessage, setEditingMessage] = useState<EditingMessage | undefined>();
  const focusRequest = useThreadFocusNonce(sessionId);
  const localStoppedMessageId = useStoppedMessageId(sessionId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottom = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const eventsQuery = useQuery({
    queryKey: chatQueryKeys.sessionEvents(sessionId),
    queryFn: () => ipcClient.chat.readSessionEvents(sessionId),
  });

  useEffect(() => {
    if (eventsQuery.data) setEvents(eventsQuery.data);
  }, [eventsQuery.data]);

  useEffect(() => {
    const listener = (_event: unknown, payload: unknown) => {
      if (!isAgentSessionEvent(payload) || payload.sessionId !== sessionId) return;
      setEvents((current) =>
        current.some((event) => event.id === payload.id) ? current : [...current, payload],
      );
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
    };
  }, [queryClient, sessionId]);

  const state = useMemo(() => reduceAgentSession(events), [events]);
  const visibleMessages = useMemo(() => agentStateToChatMessages(state), [state]);
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
  const scrollKey = scrollKeyFor(visibleMessages);

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

  useEffect(() => {
    shouldStickToBottom.current = true;
    setScrollButtonVisible(false);
    const frame = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(frame);
  }, [scrollRequest, scrollToBottom, setScrollButtonVisible, sessionId]);

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
    messagesFetching: eventsQuery.isFetching,
    isBusy,
    composerBusy: isBusy,
    canStop: isBusy,
    error,
    editingMessage,
    stoppedMessageId,
    focusRequest,
    showScrollToBottom,
    scrollRef: scrollRef as RefObject<HTMLDivElement | null>,
    handleScroll,
    scrollToBottom,
    actions: {
      send: async (input: ComposerSendInput) => {
        setEditingMessage(undefined);
        chatUiStore.getState().setStoppedMessage(sessionId, null);
        await ipcClient.chat.sendAgentCommand({
          type: "message.send",
          sessionId,
          text: input.text,
          contextRefs: input.contextRefs,
          files: input.files,
          composerContent: input.composerContent,
          modelSelection: input.modelSelection,
          reasoningLevel: input.reasoningLevel,
        });
      },
      retry: async () => {},
      regenerate: async () => {},
      editMessage: (message) => {
        if (isBusy || message.role !== "user") return;
        setEditingMessage(editingMessageFromChatMessage(message));
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
