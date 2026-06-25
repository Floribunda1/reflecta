import { ArrowDown } from "lucide-react";
import type { AgentContextRef, AgentModelSelection } from "@shared/agent";
import { Button } from "@renderer/components/ui/button";
import { cn } from "@renderer/lib/utils";
import { useMemoizedFn } from "ahooks";
import { ChatComposer } from "./composer/chat-composer";
import type { InspectableContextRef } from "./context/context-reference";
import { MessageList } from "./messages/message-list";
import { usePiAgentThreadView } from "./session/pi-thread-view";
import { useAgentModelOptionsQuery, useSelectAgentModelMutation } from "./session/server-state";
import type { ChatJumpItem } from "./session/thread-view";

const CHAT_JUMP_MIN_ITEMS = 4;

type AgentThreadPanelProps = {
  threadId: string;
  scrollRequest?: number;
  initialContextKey?: string;
  initialContextRefs?: AgentContextRef[];
  onInspectContextRef?: (ref: InspectableContextRef) => void;
};

export function AgentThreadPanel({
  threadId,
  scrollRequest = 0,
  initialContextKey,
  initialContextRefs,
  onInspectContextRef,
}: AgentThreadPanelProps) {
  const threadView = usePiAgentThreadView(threadId, scrollRequest);
  const modelOptionsQuery = useAgentModelOptionsQuery();
  const selectModelMutation = useSelectAgentModelMutation();
  const modelOptions = modelOptionsQuery.data?.options ?? [];
  const activeModel = modelOptionsQuery.data?.active ?? null;
  const modelSelectorDisabled = modelOptionsQuery.isFetching || selectModelMutation.isPending;
  const selectModel = useMemoizedFn((selection: AgentModelSelection) =>
    selectModelMutation.mutate(selection),
  );

  return (
    <main
      data-testid="agent-thread-chat"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-transparent"
    >
      <div className="relative min-h-0 flex-1">
        <div
          ref={threadView.scrollRef}
          onScroll={threadView.handleScroll}
          className="h-full min-h-0 overflow-y-auto px-6 py-6"
        >
          {threadView.messagesFetching && threadView.visibleMessages.length === 0 ? (
            <div className="flex h-full min-h-0 min-w-0 items-center justify-center text-sm text-muted-foreground">
              加载 Agent...
            </div>
          ) : (
            <MessageList
              messages={threadView.visibleMessages}
              isBusy={threadView.isBusy}
              stoppedMessageId={threadView.stoppedMessageId}
              error={threadView.error}
              onRetry={threadView.actions.retry}
              onEdit={threadView.actions.editMessage}
              onRegenerate={threadView.actions.regenerate}
              onApproveTool={(input) =>
                threadView.actions.approveTool({
                  ...input,
                  modelSelection: activeModel ?? undefined,
                })
              }
              onInspectContextRef={onInspectContextRef}
              highlightedMessageId={threadView.highlightedMessageId}
            />
          )}
        </div>
        <ChatJumpNav
          items={threadView.jumpItems}
          activeMessageId={threadView.activeJumpMessageId}
          onJump={threadView.jumpToMessage}
        />
        {threadView.showScrollToBottom ? (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="滚动到底部"
            className="absolute right-6 bottom-4 z-10 rounded-full bg-background/90 shadow-sm backdrop-blur"
            onClick={() => threadView.scrollToBottom()}
          >
            <ArrowDown />
          </Button>
        ) : null}
      </div>

      <ChatComposer
        isBusy={threadView.composerBusy}
        canStop={threadView.canStop}
        editingMessage={threadView.editingMessage}
        focusRequest={threadView.focusRequest}
        initialContextKey={initialContextKey}
        initialContextRefs={initialContextRefs}
        modelOptions={modelOptions}
        activeModel={activeModel}
        messages={threadView.visibleMessages}
        modelSelectorDisabled={modelSelectorDisabled}
        onSelectModel={selectModel}
        onSend={threadView.actions.send}
        onCancelEdit={threadView.actions.cancelEdit}
        onStop={threadView.actions.stop}
        onInspectContextRef={onInspectContextRef}
      />
    </main>
  );
}

function ChatJumpNav({
  items,
  activeMessageId,
  onJump,
}: {
  items: ChatJumpItem[];
  activeMessageId: string | null;
  onJump: (messageId: string) => void;
}) {
  if (items.length < CHAT_JUMP_MIN_ITEMS) return null;

  return (
    <nav
      data-testid="agent-chat-jump-nav"
      aria-label="消息跳转"
      className="group/jump pointer-events-auto absolute right-1 top-1/2 z-20 hidden max-h-[58%] w-4 -translate-y-1/2 overflow-x-hidden overflow-y-hidden rounded-md border border-transparent bg-transparent p-0.5 shadow-none backdrop-blur transition-[width,padding,background-color,border-color,box-shadow] duration-150 hover:w-72 hover:overflow-y-auto hover:rounded-lg hover:border-border hover:bg-background/95 hover:p-2 hover:shadow-xl focus-within:w-72 focus-within:overflow-y-auto focus-within:rounded-lg focus-within:border-border focus-within:bg-background/95 focus-within:p-2 focus-within:shadow-xl xl:block"
    >
      {items.map((item) => {
        const active = item.messageId === activeMessageId;
        return (
          <button
            key={item.messageId}
            type="button"
            data-testid="agent-chat-jump-item"
            data-active={active ? "true" : undefined}
            title={item.label}
            aria-label={item.label}
            className={cn(
              "flex h-9 w-full items-center justify-center gap-2 rounded-md px-0 text-left text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none group-hover/jump:justify-start group-hover/jump:px-2 group-focus-within/jump:justify-start group-focus-within/jump:px-2",
              active && "font-medium text-primary",
            )}
            onClick={() => onJump(item.messageId)}
          >
            <span
              data-testid="agent-chat-jump-label"
              className="hidden min-w-0 flex-1 truncate group-hover/jump:block group-focus-within/jump:block"
            >
              {item.label}
            </span>
            <span
              data-testid="agent-chat-jump-marker"
              aria-hidden
              className={cn(
                "h-0.5 w-3 shrink-0 rounded-full bg-muted-foreground/40",
                active && "bg-primary",
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}
