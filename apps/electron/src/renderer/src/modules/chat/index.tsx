import { useEffect } from "react";
import { ChatPageProvider, useChatPageContext } from "./context";
import { ChatInput } from "./components/ChatInput";
import { ChatThread } from "./components/ChatThread";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { KnowledgePanel } from "./components/KnowledgePanel";

function ChatPageInner() {
  const ctx = useChatPageContext();

  useEffect(() => {
    if (!ctx.conversations.length && !ctx.conversationsLoading) {
      void ctx.createConversation();
    }
  }, [ctx.conversations.length, ctx.conversationsLoading]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <ConversationSidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <ChatThread />
        <ChatInput />
      </main>
      <KnowledgePanel />
    </div>
  );
}

export function ChatPage() {
  return (
    <ChatPageProvider>
      <ChatPageInner />
    </ChatPageProvider>
  );
}
