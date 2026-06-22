import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@renderer/components/ui/resizable";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import { useMemoizedFn } from "ahooks";
import { ChatComposer } from "./composer/chat-composer";
import { ContextInspector } from "./context/context-inspector";
import type { InspectableContextRef } from "./context/context-reference";
import { MessageList } from "./messages/message-list";
import {
  useActiveThreadId,
  useInspectorRef,
  useChatUiActions,
  useRunningThreadId,
} from "./session/chat-ui-store";
import {
  useAgentModelOptionsQuery,
  useArchiveThreadMutation,
  useCreateThreadMutation,
  useDeleteThreadMutation,
  useGenerateThreadTitleMutation,
  useRenameThreadMutation,
  useSelectAgentModelMutation,
  useThreadsQuery,
} from "./session/server-state";
import { ThreadSidebar } from "./session/thread-sidebar";
import { useAgentThreadView } from "./session/thread-view";

function activeThreadIdFor(threads: { id: string }[], activeThreadId: string | null) {
  if (threads.length === 0) return null;
  if (activeThreadId && threads.some((thread) => thread.id === activeThreadId)) {
    return activeThreadId;
  }
  return threads[0]!.id;
}

function ThreadChat({
  threadId,
  scrollRequest,
  onInspectContextRef,
}: {
  threadId: string;
  scrollRequest: number;
  onInspectContextRef: (ref: InspectableContextRef) => void;
}) {
  const threadView = useAgentThreadView(threadId, scrollRequest);
  const modelOptionsQuery = useAgentModelOptionsQuery();
  const selectModelMutation = useSelectAgentModelMutation();
  const modelOptions = modelOptionsQuery.data?.options ?? [];
  const activeModel = modelOptionsQuery.data?.active ?? null;
  const modelSelectorDisabled = modelOptionsQuery.isFetching || selectModelMutation.isPending;
  const selectModel = useMemoizedFn((selection) => selectModelMutation.mutate(selection));

  return (
    <main
      data-testid="agent-thread-chat"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l bg-transparent"
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
            />
          )}
        </div>
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

function ChatPageContent() {
  const { confirm } = useModal();
  const threadsQuery = useThreadsQuery();
  const activeThreadId = useActiveThreadId();
  const inspectedRef = useInspectorRef();
  const runningThreadId = useRunningThreadId();
  const uiActions = useChatUiActions();
  const createThreadMutation = useCreateThreadMutation();
  const deleteThreadMutation = useDeleteThreadMutation();
  const archiveThreadMutation = useArchiveThreadMutation();
  const renameThreadMutation = useRenameThreadMutation();
  const generateThreadTitleMutation = useGenerateThreadTitleMutation();
  const threads = threadsQuery.data ?? [];
  const [threadScrollRequest, setThreadScrollRequest] = useState(0);
  const confirmDeleteThread = useMemoizedFn((threadId: string) =>
    confirm({
      title: "删除对话",
      message: "该 Agent 对话会被删除，无法恢复。确定继续吗？",
      acceptLabel: "删除",
      danger: true,
      onAccept: () => {
        uiActions.clearThread(threadId);
        deleteThreadMutation.mutate(threadId);
      },
    }),
  );
  const closeInspector = useMemoizedFn(() => uiActions.closeInspector());
  const openInspector = useMemoizedFn((ref: InspectableContextRef) => uiActions.openInspector(ref));
  const createThread = useMemoizedFn(() =>
    createThreadMutation.mutate(undefined, {
      onSuccess: (thread) => uiActions.selectThread(thread.id),
    }),
  );
  const selectThread = useMemoizedFn((threadId: string) => {
    uiActions.selectThread(threadId);
    setThreadScrollRequest((request) => request + 1);
  });
  const renameThread = useMemoizedFn((threadId: string, title: string) =>
    renameThreadMutation.mutate({ threadId, title }),
  );
  const titleGeneratingThreadId = generateThreadTitleMutation.isPending
    ? (generateThreadTitleMutation.variables ?? null)
    : null;
  const generateThreadTitle = useMemoizedFn((threadId: string) =>
    generateThreadTitleMutation.mutate(threadId),
  );
  const archiveThread = useMemoizedFn((threadId: string) => {
    uiActions.clearThread(threadId);
    archiveThreadMutation.mutate(threadId);
  });

  useEffect(() => {
    if (!threadsQuery.isFetching && threads.length === 0 && !createThreadMutation.isPending) {
      createThread();
      return;
    }

    const nextThreadId = activeThreadIdFor(threads, activeThreadId);
    if (nextThreadId && nextThreadId !== activeThreadId) selectThread(nextThreadId);
  }, [
    activeThreadId,
    createThread,
    createThreadMutation.isPending,
    selectThread,
    threads,
    threadsQuery.isFetching,
  ]);

  return (
    <div
      data-testid="agent-page"
      className="grid h-full min-h-0 w-full grid-cols-[248px_minmax(0,1fr)] overflow-hidden bg-background/45 backdrop-blur-2xl"
    >
      <ThreadSidebar
        threads={threads}
        pending={threadsQuery.isFetching}
        activeThreadId={activeThreadId}
        runningThreadId={runningThreadId}
        onSelect={selectThread}
        onCreate={createThread}
        onRename={renameThread}
        onGenerateTitle={generateThreadTitle}
        onArchive={archiveThread}
        onDelete={confirmDeleteThread}
        titleGeneratingThreadId={titleGeneratingThreadId}
      />
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={
          inspectedRef
            ? {
                "agent-chat-main": 58,
                "agent-chat-inspector": 42,
              }
            : {
                "agent-chat-main": 100,
              }
        }
        className="min-h-0 min-w-0 bg-card/70 backdrop-blur-sm"
      >
        <ResizablePanel
          id="agent-chat-main"
          minSize="28%"
          defaultSize={inspectedRef ? "58%" : "100%"}
          className="min-h-0 min-w-0"
        >
          <div className="h-full min-h-0 min-w-0">
            {activeThreadId ? (
              <ThreadChat
                key={activeThreadId}
                threadId={activeThreadId}
                scrollRequest={threadScrollRequest}
                onInspectContextRef={openInspector}
              />
            ) : (
              <main className="flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden border-l bg-transparent text-sm text-muted-foreground">
                加载 Agent...
              </main>
            )}
          </div>
        </ResizablePanel>
        {inspectedRef ? (
          <>
            <ResizableHandle
              withHandle
              className="w-3 cursor-col-resize bg-transparent after:w-px after:bg-border/50 hover:after:bg-border data-[resize-handle-active]:after:bg-ring [&>div]:h-10 [&>div]:w-0.5 [&>div]:bg-border/70"
            />
            <ResizablePanel
              id="agent-chat-inspector"
              minSize="30%"
              defaultSize="42%"
              maxSize="68%"
              className="min-h-0 min-w-0"
            >
              <div className="h-full min-h-0 min-w-0">
                <ContextInspector
                  refToInspect={inspectedRef}
                  onClose={closeInspector}
                  onInspect={openInspector}
                />
              </div>
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}

export function ChatPage() {
  return <ChatPageContent />;
}
