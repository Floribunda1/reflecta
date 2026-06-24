import { useEffect, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@renderer/components/ui/resizable";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import { useMemoizedFn } from "ahooks";
import { AgentThreadPanel } from "./agent-thread-panel";
import { ContextInspector } from "./context/context-inspector";
import type { InspectableContextRef } from "./context/context-reference";
import {
  useActiveThreadId,
  useInspectorRef,
  useAgentUiActions,
  useRunningThreadId,
} from "./session/chat-ui-store";
import {
  useArchiveThreadMutation,
  useCreateThreadMutation,
  useDeleteThreadMutation,
  useForkThreadMutation,
  useGenerateThreadTitleMutation,
  useRenameThreadMutation,
  useThreadsQuery,
} from "./session/server-state";
import { ThreadSidebar } from "./session/thread-sidebar";

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
  return (
    <div className="h-full min-h-0 min-w-0 border-l">
      <AgentThreadPanel
        threadId={threadId}
        scrollRequest={scrollRequest}
        onInspectContextRef={onInspectContextRef}
      />
    </div>
  );
}

function ChatPageContent() {
  const { confirm } = useModal();
  const threadsQuery = useThreadsQuery();
  const activeThreadId = useActiveThreadId();
  const inspectedRef = useInspectorRef();
  const runningThreadId = useRunningThreadId();
  const uiActions = useAgentUiActions();
  const createThreadMutation = useCreateThreadMutation();
  const deleteThreadMutation = useDeleteThreadMutation();
  const forkThreadMutation = useForkThreadMutation();
  const archiveThreadMutation = useArchiveThreadMutation();
  const renameThreadMutation = useRenameThreadMutation();
  const generateThreadTitleMutation = useGenerateThreadTitleMutation();
  const threads = threadsQuery.data ?? [];
  const [threadScrollRequest, setThreadScrollRequest] = useState(0);
  const [draftThreadId, setDraftThreadId] = useState<string | null>(null);
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
      onSuccess: (thread) => {
        setDraftThreadId(thread.id);
        uiActions.selectThread(thread.id);
      },
    }),
  );
  const selectThread = useMemoizedFn((threadId: string) => {
    setDraftThreadId(null);
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
  const forkThread = useMemoizedFn((threadId: string) =>
    forkThreadMutation.mutate(threadId, {
      onSuccess: (thread) => uiActions.selectThread(thread.id),
    }),
  );
  const archiveThread = useMemoizedFn((threadId: string) => {
    uiActions.clearThread(threadId);
    archiveThreadMutation.mutate(threadId);
  });

  useEffect(() => {
    if (draftThreadId && threads.some((thread) => thread.id === draftThreadId)) {
      setDraftThreadId(null);
    }
  }, [draftThreadId, threads]);

  useEffect(() => {
    if (threadsQuery.isFetching || createThreadMutation.isPending) return;

    const activeIsPersisted = activeThreadId
      ? threads.some((thread) => thread.id === activeThreadId)
      : false;
    const activeIsDraft = Boolean(activeThreadId && activeThreadId === draftThreadId);

    if (threads.length === 0) {
      if (!activeIsDraft) createThread();
      return;
    }

    if (activeIsDraft) return;

    if (activeThreadId && !activeIsPersisted) {
      selectThread(threads[0]!.id);
      return;
    }

    const nextThreadId = activeThreadIdFor(threads, activeThreadId);
    if (nextThreadId && nextThreadId !== activeThreadId) selectThread(nextThreadId);
  }, [
    activeThreadId,
    createThread,
    createThreadMutation.isPending,
    draftThreadId,
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
        onFork={forkThread}
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
