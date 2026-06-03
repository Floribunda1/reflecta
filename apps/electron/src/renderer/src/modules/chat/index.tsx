import { defineComponent, onMounted, watch } from "vue";
import { useChatPageContext, useChatPageProvide } from "./context";
import { ChatInput } from "./components/ChatInput";
import { ChatThread } from "./components/ChatThread";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { KnowledgePanel } from "./components/KnowledgePanel";

const ChatPageInner = defineComponent({
  name: "ChatPageInner",
  setup() {
    const ctx = useChatPageContext()!;

    onMounted(() => {
      if (!ctx.conversations.value.length && !ctx.conversationsLoading.value) {
        void ctx.createConversation();
      }
    });

    watch(
      () => ctx.conversations.value.length,
      (count) => {
        if (count === 0 && !ctx.conversationsLoading.value && !ctx.isStreaming.value) {
          void ctx.createConversation();
        }
      },
    );

    return () => (
      <div class="flex h-full w-full overflow-hidden bg-surface-0">
        <ConversationSidebar />
        <main class="flex min-w-0 flex-1 flex-col">
          <ChatThread />
          <ChatInput />
        </main>
        <KnowledgePanel />
      </div>
    );
  },
});

export const ChatPage = defineComponent({
  name: "ChatPage",
  setup() {
    useChatPageProvide();
    return () => <ChatPageInner />;
  },
});
