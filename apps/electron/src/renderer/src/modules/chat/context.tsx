import { ipcClient } from "@renderer/utils/ipc";
import type { ConversationDTO } from "@shared/chat";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { createInjectionState, useLocalStorage } from "@vueuse/core";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onChatStreamEvent } from "./stream/on-chat-stream-event";
import {
  buildThreadItems,
  createInitialTurnState,
  reduceTurnState,
} from "./state/chat-turn-reducer";
import type { ActiveTurnState, KnowledgePanelMode } from "./state/types";

const [useChatPageProvide, useChatPageContext] = createInjectionState(() => {
  const queryClient = useQueryClient();
  const activeConversationId = useLocalStorage<string | null>("chat:activeConversationId", null);
  const activeTurn = ref<ActiveTurnState | null>(null);
  const draftText = ref("");
  const draftThoughtIds = ref<string[]>([]);
  const conversationThoughtIds = ref<string[]>([]);
  const thoughtSummaries = ref<Record<string, ThoughtSummaryDTO>>({});

  const panelMode = ref<KnowledgePanelMode>("browse");
  const selectedCategoryId = ref<string>("all");
  const selectedThoughtId = ref<string | null>(null);
  const panelSearchQuery = ref("");

  const isStreaming = computed(() => {
    const turn = activeTurn.value;
    if (!turn) return false;
    return ["sending", "streaming", "waiting_tool"].includes(turn.status);
  });

  const conversationsQuery = useQuery({
    queryKey: ["chat.conversations"],
    queryFn: () => ipcClient.chat.listConversations(),
  });

  const messagesQuery = useQuery({
    queryKey: computed(() => ["chat.messages", activeConversationId.value] as const),
    queryFn: () => ipcClient.chat.getMessages(activeConversationId.value!),
    enabled: computed(() => !!activeConversationId.value),
  });

  watch(
    () => conversationsQuery.data.value,
    (conversations) => {
      if (!conversations?.length) return;
      if (
        !activeConversationId.value ||
        !conversations.some((c) => c.id === activeConversationId.value)
      ) {
        activeConversationId.value = conversations[0]!.id;
      }
    },
    { immediate: true },
  );

  const invalidateChatQueries = async (conversationId: string | null) => {
    await queryClient.invalidateQueries({ queryKey: ["chat.conversations"] });
    if (conversationId) {
      await queryClient.invalidateQueries({ queryKey: ["chat.messages", conversationId] });
    }
  };

  const clearTurn = () => {
    activeTurn.value = null;
  };

  let unsubscribeStream: (() => void) | null = null;

  onMounted(() => {
    unsubscribeStream = onChatStreamEvent(({ requestId, event }) => {
      const turn = activeTurn.value;
      if (!turn || turn.requestId !== requestId) return;

      activeTurn.value = reduceTurnState(turn, event);

      if (event.type === "done") {
        const conversationId = activeTurn.value?.conversationId ?? activeConversationId.value;
        void invalidateChatQueries(conversationId).then(clearTurn);
      }
    });
  });

  onUnmounted(() => {
    unsubscribeStream?.();
  });

  const selectConversation = (conversationId: string) => {
    if (isStreaming.value) return;
    activeConversationId.value = conversationId;
    clearTurn();
    draftText.value = "";
    draftThoughtIds.value = [];
    conversationThoughtIds.value = [];
    thoughtSummaries.value = {};
  };

  const createConversation = async () => {
    if (isStreaming.value) return;
    const conversation = await ipcClient.chat.createConversation();
    await invalidateChatQueries(conversation.id);
    activeConversationId.value = conversation.id;
    clearTurn();
    draftText.value = "";
    draftThoughtIds.value = [];
    conversationThoughtIds.value = [];
    thoughtSummaries.value = {};
    return conversation;
  };

  const renameConversation = async (conversationId: string, title: string) => {
    await ipcClient.chat.renameConversation(conversationId, title);
    await invalidateChatQueries(conversationId);
  };

  const deleteConversation = async (conversationId: string) => {
    if (isStreaming.value) return;
    await ipcClient.chat.deleteConversation(conversationId);
    if (activeConversationId.value === conversationId) {
      activeConversationId.value = null;
      clearTurn();
    }
    await invalidateChatQueries(null);
  };

  const ensureThoughtSummary = async (thoughtId: string) => {
    if (thoughtSummaries.value[thoughtId]) return;
    const thought = await ipcClient.thought.getThoughtById(thoughtId);
    if (!thought) return;
    thoughtSummaries.value = {
      ...thoughtSummaries.value,
      [thoughtId]: {
        id: thought.id,
        title: thought.title,
        body: thought.body,
        type: thought.type,
        categoryIds: thought.categoryIds,
        contextCount: thought.contexts.length,
        connectionCount: thought.connections.length,
        connectionIds: thought.connections.map((item) => item.id),
        createdAt: thought.createdAt,
        updatedAt: thought.updatedAt,
      },
    };
  };

  const addReference = async (thoughtId: string) => {
    if (!draftThoughtIds.value.includes(thoughtId)) {
      draftThoughtIds.value = [...draftThoughtIds.value, thoughtId];
    }
    await ensureThoughtSummary(thoughtId);
  };

  const removeDraftReference = (thoughtId: string) => {
    draftThoughtIds.value = draftThoughtIds.value.filter((id) => id !== thoughtId);
  };

  const clearDraftReferences = () => {
    draftThoughtIds.value = [];
  };

  const sendMessage = async () => {
    const content = draftText.value.trim();
    const conversationId = activeConversationId.value;
    if (!conversationId || !content || isStreaming.value) return;

    const referenceThoughtIds = [...draftThoughtIds.value];
    const optimisticUserMessage = {
      id: `opt-${Date.now()}`,
      role: "user" as const,
      content,
      createdAt: new Date().toISOString(),
    };

    activeTurn.value = createInitialTurnState(conversationId, optimisticUserMessage);
    draftText.value = "";

    for (const thoughtId of referenceThoughtIds) {
      if (!conversationThoughtIds.value.includes(thoughtId)) {
        conversationThoughtIds.value = [...conversationThoughtIds.value, thoughtId];
      }
      await ensureThoughtSummary(thoughtId);
    }

    draftThoughtIds.value = [];

    try {
      const { requestId } = await ipcClient.chat.sendMessage({
        conversationId,
        content,
        referenceThoughtIds: referenceThoughtIds.length > 0 ? referenceThoughtIds : undefined,
      });
      if (activeTurn.value) {
        activeTurn.value = { ...activeTurn.value, requestId, status: "streaming" };
      }
    } catch (error) {
      activeTurn.value = {
        ...activeTurn.value!,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "发送失败",
      };
    }
  };

  const cancelStream = async () => {
    const turn = activeTurn.value;
    if (!turn?.requestId) return;
    await ipcClient.chat.cancelStream({ requestId: turn.requestId });
    activeTurn.value = { ...turn, status: "cancelled" };
    setTimeout(clearTurn, 300);
  };

  const confirmToolCall = async (toolCallId: string, approved: boolean) => {
    const turn = activeTurn.value;
    if (!turn?.requestId) return;
    if (approved) {
      await ipcClient.chat.confirmToolCall({
        requestId: turn.requestId,
        toolCallId,
        approved: true,
      });
    } else {
      await ipcClient.chat.rejectToolCall({
        requestId: turn.requestId,
        toolCallId,
        approved: false,
      });
    }
  };

  const threadItems = computed(() =>
    buildThreadItems(messagesQuery.data.value ?? [], activeTurn.value),
  );

  const draftReferences = computed(() =>
    draftThoughtIds.value
      .map((id) => thoughtSummaries.value[id])
      .filter((item): item is ThoughtSummaryDTO => !!item),
  );

  const conversationReferences = computed(() =>
    conversationThoughtIds.value
      .map((id) => thoughtSummaries.value[id])
      .filter((item): item is ThoughtSummaryDTO => !!item),
  );

  const conversations = computed<ConversationDTO[]>(() => conversationsQuery.data.value ?? []);
  const canSend = computed(
    () => !!activeConversationId.value && !!draftText.value.trim() && !isStreaming.value,
  );

  return {
    activeConversationId,
    conversations,
    conversationsLoading: computed(() => conversationsQuery.isFetching.value),
    messagesLoading: computed(() => messagesQuery.isFetching.value),
    threadItems,
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
  };
});

export { useChatPageProvide, useChatPageContext };
