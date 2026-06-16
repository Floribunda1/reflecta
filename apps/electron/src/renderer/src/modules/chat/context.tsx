import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { ConversationDTO } from "@shared/chat";
import type { ThoughtSummaryDTO } from "@shared/thought";
import type { ChatStatus, UIMessage } from "ai";
import { useLocalStorageState } from "@renderer/modules/shared/hooks/use-local-storage-state";
import { ReflectaChat } from "./libs/reflecta-chat";
import { dtoListToUiMessages } from "./transport/dto-to-ui-message";
import { ElectronChatTransport } from "./transport/electron-chat-transport";
import type { KnowledgePanelMode } from "./state/types";

type ChatPageContextValue = {
  activeConversationId: string | null;
  chat: ReflectaChat<UIMessage> | null;
  chatMessages: UIMessage[];
  chatStatus: ChatStatus;
  chatError: Error | undefined;
  conversations: ConversationDTO[];
  conversationsLoading: boolean;
  messagesLoading: boolean;
  isStreaming: boolean;
  canSend: boolean;
  draftText: string;
  setDraftText: (value: string) => void;
  draftThoughtIds: string[];
  draftReferences: ThoughtSummaryDTO[];
  conversationThoughtIds: string[];
  conversationReferences: ThoughtSummaryDTO[];
  thoughtSummaries: Record<string, ThoughtSummaryDTO>;
  panelMode: KnowledgePanelMode;
  setPanelMode: (value: KnowledgePanelMode) => void;
  selectedCategoryId: string;
  setSelectedCategoryId: (value: string) => void;
  selectedThoughtId: string | null;
  setSelectedThoughtId: (value: string | null) => void;
  panelSearchQuery: string;
  setPanelSearchQuery: (value: string) => void;
  selectConversation: (conversationId: string) => void;
  createConversation: () => Promise<ConversationDTO | undefined>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  addReference: (thoughtId: string) => Promise<void>;
  removeDraftReference: (thoughtId: string) => void;
  clearDraftReferences: () => void;
  sendMessage: () => Promise<void>;
  cancelStream: () => Promise<void>;
  confirmToolCall: (toolCallId: string, approved: boolean) => Promise<void>;
};

const ChatPageContext = createContext<ChatPageContextValue | null>(null);
const EMPTY_CHAT_MESSAGES: UIMessage[] = [];
const noopSubscribe = () => () => undefined;

export function ChatPageProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useLocalStorageState<string | null>(
    "chat:activeConversationId",
    null,
  );
  const [chat, setChat] = useState<ReflectaChat<UIMessage> | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftThoughtIds, setDraftThoughtIds] = useState<string[]>([]);
  const [conversationThoughtIds, setConversationThoughtIds] = useState<string[]>([]);
  const [thoughtSummaries, setThoughtSummaries] = useState<Record<string, ThoughtSummaryDTO>>({});
  const [panelMode, setPanelMode] = useState<KnowledgePanelMode>("browse");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedThoughtId, setSelectedThoughtId] = useState<string | null>(null);
  const [panelSearchQuery, setPanelSearchQuery] = useState("");

  const chatMessages = useSyncExternalStore(
    chat?.reactState.subscribe ?? noopSubscribe,
    () => chat?.reactState.messages ?? EMPTY_CHAT_MESSAGES,
  );
  const chatStatus = useSyncExternalStore(
    chat?.reactState.subscribe ?? noopSubscribe,
    () => chat?.reactState.status ?? "ready",
  );
  const chatError = useSyncExternalStore(
    chat?.reactState.subscribe ?? noopSubscribe,
    () => chat?.reactState.error,
  );

  const isStreaming = chatStatus === "submitted" || chatStatus === "streaming";

  const conversationsQuery = useQuery({
    queryKey: ["chat.conversations"],
    queryFn: () => ipcClient.chat.listConversations(),
  });

  const messagesQuery = useQuery({
    queryKey: ["chat.messages", activeConversationId] as const,
    queryFn: () => ipcClient.chat.getMessages(activeConversationId!),
    enabled: !!activeConversationId,
  });

  useEffect(() => {
    const conversations = conversationsQuery.data;
    if (!conversations?.length) return;
    if (
      !activeConversationId ||
      !conversations.some((conversation) => conversation.id === activeConversationId)
    ) {
      setActiveConversationId(conversations[0]!.id);
    }
  }, [conversationsQuery.data, activeConversationId, setActiveConversationId]);

  const invalidateChatQueries = async (conversationId: string | null) => {
    await queryClient.invalidateQueries({ queryKey: ["chat.conversations"] });
    if (conversationId)
      await queryClient.invalidateQueries({ queryKey: ["chat.messages", conversationId] });
  };

  const createChatInstance = (conversationId: string, messages: UIMessage[]) =>
    new ReflectaChat({
      id: conversationId,
      messages,
      transport: new ElectronChatTransport(conversationId, {
        onRequestStart: setActiveRequestId,
        onRequestEnd: () => setActiveRequestId(null),
      }),
      onFinish: () => {
        void queryClient.invalidateQueries({ queryKey: ["chat.conversations"] });
      },
    });

  useEffect(() => {
    setChat(null);
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || chat) return;
    if (messagesQuery.isFetching && !messagesQuery.data?.length) return;
    setChat(
      createChatInstance(activeConversationId, dtoListToUiMessages(messagesQuery.data ?? [])),
    );
  }, [activeConversationId, messagesQuery.data, messagesQuery.isFetching, chat]);

  const selectConversation = (conversationId: string) => {
    if (isStreaming) return;
    setActiveConversationId(conversationId);
    setDraftText("");
    setDraftThoughtIds([]);
    setConversationThoughtIds([]);
    setThoughtSummaries({});
  };

  const createConversation = async () => {
    if (isStreaming) return undefined;
    const conversation = await ipcClient.chat.createConversation();
    await invalidateChatQueries(conversation.id);
    setActiveConversationId(conversation.id);
    setDraftText("");
    setDraftThoughtIds([]);
    setConversationThoughtIds([]);
    setThoughtSummaries({});
    return conversation;
  };

  const renameConversation = async (conversationId: string, title: string) => {
    await ipcClient.chat.renameConversation(conversationId, title);
    await invalidateChatQueries(conversationId);
  };

  const deleteConversation = async (conversationId: string) => {
    if (isStreaming) return;
    await ipcClient.chat.deleteConversation(conversationId);
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
      setChat(null);
    }
    await invalidateChatQueries(null);
  };

  const ensureThoughtSummary = async (thoughtId: string) => {
    if (thoughtSummaries[thoughtId]) return;
    const thought = await ipcClient.thought.getThoughtById(thoughtId);
    if (!thought) return;
    setThoughtSummaries((current) => ({
      ...current,
      [thoughtId]: {
        id: thought.id,
        title: thought.title,
        body: thought.body,
        categoryIds: thought.categoryIds,
        contextCount: thought.contexts.length,
        connectionCount: thought.connections.length,
        connectionIds: thought.connections.map((item) => item.id),
        createdAt: thought.createdAt,
        updatedAt: thought.updatedAt,
      },
    }));
  };

  const addReference = async (thoughtId: string) => {
    setDraftThoughtIds((current) =>
      current.includes(thoughtId) ? current : [...current, thoughtId],
    );
    await ensureThoughtSummary(thoughtId);
  };

  const removeDraftReference = (thoughtId: string) => {
    setDraftThoughtIds((current) => current.filter((id) => id !== thoughtId));
  };

  const clearDraftReferences = () => setDraftThoughtIds([]);

  const sendMessage = async () => {
    const content = draftText.trim();
    if (!activeConversationId || !content || !chat || isStreaming) return;
    const referenceThoughtIds = [...draftThoughtIds];
    setDraftText("");
    for (const thoughtId of referenceThoughtIds) {
      setConversationThoughtIds((current) =>
        current.includes(thoughtId) ? current : [...current, thoughtId],
      );
      await ensureThoughtSummary(thoughtId);
    }
    setDraftThoughtIds([]);
    await chat.sendMessage(
      { text: content },
      {
        body: {
          referenceThoughtIds: referenceThoughtIds.length > 0 ? referenceThoughtIds : undefined,
        },
      },
    );
  };

  const cancelStream = async () => {
    await chat?.stop();
  };

  const confirmToolCall = async (toolCallId: string, approved: boolean) => {
    if (!activeRequestId || !chat) return;
    await chat.addToolApprovalResponse({ id: toolCallId, approved });
    if (approved) {
      await ipcClient.chat.confirmToolCall({
        requestId: activeRequestId,
        toolCallId,
        approved: true,
      });
    } else {
      await ipcClient.chat.rejectToolCall({
        requestId: activeRequestId,
        toolCallId,
        approved: false,
      });
    }
  };

  const draftReferences = draftThoughtIds
    .map((id) => thoughtSummaries[id])
    .filter((item): item is ThoughtSummaryDTO => !!item);
  const conversationReferences = conversationThoughtIds
    .map((id) => thoughtSummaries[id])
    .filter((item): item is ThoughtSummaryDTO => !!item);
  const conversations = conversationsQuery.data ?? [];
  const canSend = !!activeConversationId && !!draftText.trim() && !isStreaming;

  const value = useMemo<ChatPageContextValue>(
    () => ({
      activeConversationId,
      chat,
      chatMessages,
      chatStatus,
      chatError,
      conversations,
      conversationsLoading: conversationsQuery.isFetching,
      messagesLoading: messagesQuery.isFetching,
      isStreaming,
      canSend,
      draftText,
      setDraftText,
      draftThoughtIds,
      draftReferences,
      conversationThoughtIds,
      conversationReferences,
      thoughtSummaries,
      panelMode,
      setPanelMode,
      selectedCategoryId,
      setSelectedCategoryId,
      selectedThoughtId,
      setSelectedThoughtId,
      panelSearchQuery,
      setPanelSearchQuery,
      selectConversation,
      createConversation,
      renameConversation,
      deleteConversation,
      addReference,
      removeDraftReference,
      clearDraftReferences,
      sendMessage,
      cancelStream,
      confirmToolCall,
    }),
    [
      activeConversationId,
      chat,
      chatMessages,
      chatStatus,
      chatError,
      conversations,
      conversationsQuery.isFetching,
      messagesQuery.isFetching,
      isStreaming,
      canSend,
      draftText,
      draftThoughtIds,
      draftReferences,
      conversationThoughtIds,
      conversationReferences,
      thoughtSummaries,
      panelMode,
      selectedCategoryId,
      selectedThoughtId,
      panelSearchQuery,
    ],
  );

  return <ChatPageContext.Provider value={value}>{children}</ChatPageContext.Provider>;
}

export function useChatPageContext() {
  const context = useContext(ChatPageContext);
  if (!context) throw new Error("useChatPageContext must be used within ChatPageProvider");
  return context;
}
