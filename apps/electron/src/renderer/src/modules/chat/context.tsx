import { ipcClient } from "@renderer/utils/ipc";
import type { ConversationDTO } from "@shared/chat";
import type { ThoughtSummaryDTO } from "@shared/thought";
import type { ChatStatus, UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { createInjectionState, useLocalStorage } from "@vueuse/core";
import { computed, ref, shallowRef, watch } from "vue";
import { ReflectaChat } from "./libs/reflecta-chat";
import { dtoListToUiMessages } from "./transport/dto-to-ui-message";
import { ElectronChatTransport } from "./transport/electron-chat-transport";
import type { KnowledgePanelMode } from "./state/types";

const [useChatPageProvide, useChatPageContext] = createInjectionState(() => {
  const queryClient = useQueryClient();
  const activeConversationId = useLocalStorage<string | null>("chat:activeConversationId", null);
  const chat = shallowRef<ReflectaChat<UIMessage> | null>(null);
  const activeRequestId = ref<string | null>(null);
  const draftText = ref("");
  const draftThoughtIds = ref<string[]>([]);
  const conversationThoughtIds = ref<string[]>([]);
  const thoughtSummaries = ref<Record<string, ThoughtSummaryDTO>>({});

  const panelMode = ref<KnowledgePanelMode>("browse");
  const selectedCategoryId = ref<string>("all");
  const selectedThoughtId = ref<string | null>(null);
  const panelSearchQuery = ref("");

  const chatStatus = computed<ChatStatus>(() => chat.value?.vueState.statusRef.value ?? "ready");
  const chatError = computed(() => chat.value?.vueState.errorRef.value);
  const chatMessages = computed<UIMessage[]>(() => chat.value?.vueState.messagesRef.value ?? []);

  const isStreaming = computed(() => {
    const status = chatStatus.value;
    return status === "submitted" || status === "streaming";
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

  const createChatInstance = (conversationId: string, messages: UIMessage[]) => {
    return new ReflectaChat({
      id: conversationId,
      messages,
      transport: new ElectronChatTransport(conversationId, {
        onRequestStart: (requestId) => {
          activeRequestId.value = requestId;
        },
        onRequestEnd: () => {
          activeRequestId.value = null;
        },
      }),
      onFinish: () => {
        void queryClient.invalidateQueries({ queryKey: ["chat.conversations"] });
      },
    });
  };

  watch(activeConversationId, (conversationId, previousId) => {
    if (conversationId === previousId) return;
    chat.value = null;
  });

  watch(
    [activeConversationId, () => messagesQuery.data.value, () => messagesQuery.isFetching.value],
    ([conversationId, history, isFetching]) => {
      if (!conversationId || chat.value) return;
      if (isFetching && !history?.length) return;
      chat.value = createChatInstance(conversationId, dtoListToUiMessages(history ?? []));
    },
    { immediate: true },
  );

  const selectConversation = (conversationId: string) => {
    if (isStreaming.value) return;
    activeConversationId.value = conversationId;
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
      chat.value = null;
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
    const activeChat = chat.value;
    if (!conversationId || !content || !activeChat || isStreaming.value) return;

    const referenceThoughtIds = [...draftThoughtIds.value];
    draftText.value = "";

    for (const thoughtId of referenceThoughtIds) {
      if (!conversationThoughtIds.value.includes(thoughtId)) {
        conversationThoughtIds.value = [...conversationThoughtIds.value, thoughtId];
      }
      await ensureThoughtSummary(thoughtId);
    }

    draftThoughtIds.value = [];

    await activeChat.sendMessage(
      { text: content },
      {
        body: {
          referenceThoughtIds: referenceThoughtIds.length > 0 ? referenceThoughtIds : undefined,
        },
      },
    );
  };

  const cancelStream = async () => {
    await chat.value?.stop();
  };

  const confirmToolCall = async (toolCallId: string, approved: boolean) => {
    const requestId = activeRequestId.value;
    const activeChat = chat.value;
    if (!requestId || !activeChat) return;

    await activeChat.addToolApprovalResponse({
      id: toolCallId,
      approved,
    });

    if (approved) {
      await ipcClient.chat.confirmToolCall({
        requestId,
        toolCallId,
        approved: true,
      });
    } else {
      await ipcClient.chat.rejectToolCall({
        requestId,
        toolCallId,
        approved: false,
      });
    }
  };

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
    chat,
    chatMessages,
    chatStatus,
    chatError,
    conversations,
    conversationsLoading: computed(() => conversationsQuery.isFetching.value),
    messagesLoading: computed(() => messagesQuery.isFetching.value),
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
